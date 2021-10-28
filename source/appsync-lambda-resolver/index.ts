// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
import { IAppSyncResolverRequest, IAvaTopicSubscription, SubscriptionProtocols, SupportedMutationFieldNames, SupportedParentTypeNames, SupportedQueryFieldNames, IGetPrevDayIssuesStatsOutput } from './lib/utils';
import { getOptions } from '../solution-utils/get-options';
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';
import moment from 'moment';

// Import AWS SDK
import SNS from 'aws-sdk/clients/sns';
import DDB from 'aws-sdk/clients/dynamodb';
const awsSdkOptions = getOptions();
const snsClient = new SNS(awsSdkOptions);
const ddbDocClient = new DDB.DocumentClient(awsSdkOptions);

const { AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL, ISSUE_NOTIFICATION_TOPIC_ARN, DATA_HIERARCHY_TABLE_NAME, ISSUES_TABLE_NAME } = process.env;
const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

/**
 * Request handler.
 */
export async function handler(event: IAppSyncResolverRequest): Promise<any> {
  logger.log(LogLevel.INFO, 'Received event', JSON.stringify(event, null, 2));

  // Ensure this handler supports the incoming handler event input
  validateHandlerInput(event);

  if (event.info.parentTypeName === SupportedParentTypeNames.MUTATION) {
    // The ID for the AVA Event
    const eventId = event.prev.result.id;

    switch (event.info.fieldName) {
      case SupportedMutationFieldNames.CREATE_EVENT:
      case SupportedMutationFieldNames.UPDATE_EVENT:
        let subscriptionsForEvent: IAvaTopicSubscription[] = [];

        if (event.prev.result.email) {
          // Add an array of email addresses that need to be subscribed to notifications for this event
          subscriptionsForEvent.push(
            ...(event.prev.result.email as string).split(',').map(email => {
              return { protocol: SubscriptionProtocols.EMAIL, endpoint: email.trim() };
            })
          );
        }

        if (event.prev.result.sms) {
          // Add an array of phone numbers that need to be subscribed to notifications for this event
          subscriptionsForEvent.push(
            ...(event.prev.result.sms as string).split(',').map(phoneNumber => {
              return { protocol: SubscriptionProtocols.SMS, endpoint: phoneNumber.trim() };
            })
          );
        }

        logger.log(LogLevel.INFO, `Total number of subscriptions for event: ${subscriptionsForEvent.length}`);

        for (let i = 0; i < subscriptionsForEvent.length; i++) {
          logger.log(LogLevel.INFO, `Handling subscription #${i + 1} of ${subscriptionsForEvent.length} total subscriptions`);
          logger.log(LogLevel.VERBOSE, 'Handling subscription', JSON.stringify(subscriptionsForEvent, null, 2));

          let subscription: IAvaTopicSubscription = await getSubscriptionFromDataHierarchyTable(subscriptionsForEvent[i]);
          let subscriptionUpdated = false;

          if (!subscription) {
            logger.log(LogLevel.INFO, 'Subscription did not exist. It will need to be created');

            // Set the base attributes of the subscription. 
            // `placeholder-event-id` is included just in case this endpoint will be
            // removed from all events. You cannot set a filter policy with an empty array
            subscription = {
              protocol: subscriptionsForEvent[i].protocol,
              endpoint: subscriptionsForEvent[i].endpoint,
              filterPolicy: { eventId: ['placeholder-event-id', eventId] }
            }

            // Create the new subscription
            const subscriptionArn = await subscribeToIssueNotificationTopic(subscription);

            // Update the subscription object with the newly created SubscriptionArn
            subscription.subscriptionArn = subscriptionArn;
            subscriptionUpdated = true;
          } else {
            logger.log(LogLevel.INFO, 'Subscription already existed');

            if (subscription.filterPolicy.eventId.includes(eventId)) {
              logger.log(LogLevel.INFO, `Filter policy already included event ID (${eventId}). No need to update`);
            } else {
              logger.log(LogLevel.INFO, `Filter policy will be updated to include event ID (${eventId})`);
              subscription.filterPolicy.eventId.push(eventId);

              await updateSubscriptionFilterPolicy(subscription);
              subscriptionUpdated = true;
            }
          }

          if (subscriptionUpdated && subscription.subscriptionArn && subscription.subscriptionArn.trim() !== '') {
            logger.log(LogLevel.INFO, 'Persisting subscription details in the Data Hierarchy table');
            await persistSubscriptionInDataHierarchyTable(subscription);
          }
        }

        await cleanupPreviousSubscriptions(subscriptionsForEvent, event.arguments.previousSms, event.arguments.previousEmail, eventId);
        break;
      case SupportedMutationFieldNames.DELETE_EVENT:
        await cleanupPreviousSubscriptions([], event.prev.result.sms, event.prev.result.email, eventId);
        break;
    }

    // return the result from previous AppSync pipeline functions
    return event.prev.result;
  } else {
    return getPrevDayIssuesStats();
  }
}

/**
 * Validates that the input to this handler can be properly handled
 * @param event Handler input payload
 */
function validateHandlerInput(event: IAppSyncResolverRequest): void {
  if (!event) {
    logger.log(LogLevel.ERROR, 'Event input was null or undefined');
    throw new Error('Invalid handler input');
  }

  // Validate that this AppSync field is supported by this handler
  if (!Object.values(SupportedParentTypeNames).includes(event.info.parentTypeName as SupportedParentTypeNames)) {
    throw new Error(`Unsupported parent type name: ${event.info.parentTypeName}`);
  }

  if (event.info.parentTypeName === SupportedParentTypeNames.MUTATION) {
    // Throw an error if there was no previous result from an earlier pipeline function
    // that would have created/updated/deleted the event in the DynamoDB table
    if (!event.prev || !event.prev.result) {
      logger.log(LogLevel.ERROR, 'Details from previous AppSync function were not present');
      throw new Error('Unable to retrieve new Event details');
    }

    if (!event.prev.result.id) {
      throw new Error('Event ID from previous AppSync function was not present');
    }

    if (!Object.values(SupportedMutationFieldNames).includes(event.info.fieldName as SupportedMutationFieldNames)) {
      throw new Error(`Unsupported ${event.info.parentTypeName} field name: ${event.info.fieldName}`);
    }
  } else {
    if (!Object.values(SupportedQueryFieldNames).includes(event.info.fieldName as SupportedQueryFieldNames)) {
      throw new Error(`Unsupported ${event.info.parentTypeName} field name: ${event.info.fieldName}`);
    }
  }
}

/**
 * Retrieves the subscription from the data hierarchy table
 * @param subscription IAvaTopicSubscription
 */
async function getSubscriptionFromDataHierarchyTable(subscription: IAvaTopicSubscription): Promise<IAvaTopicSubscription> {
  const getParams: DDB.DocumentClient.GetItemInput = {
    TableName: DATA_HIERARCHY_TABLE_NAME,
    Key: {
      id: subscription.endpoint,
      type: 'ISSUE_TOPIC_SUBSCRIPTION'
    }
  };

  logger.log(LogLevel.VERBOSE, 'Getting subscription', JSON.stringify(getParams, null, 2));
  const resp = await ddbDocClient.get(getParams).promise();
  logger.log(LogLevel.VERBOSE, 'Get subscription response', JSON.stringify(resp, null, 2));

  if (resp.Item) {
    return {
      endpoint: resp.Item.endpoint,
      protocol: resp.Item.protocol,
      filterPolicy: resp.Item.filterPolicy,
      subscriptionArn: resp.Item.subscriptionArn
    }
  }

  return null;
}

/**
 * Stores the subscription details in the  data hierarchy table so they can be retrieved later
 * if this subscription needs to be updated
 * @param subscription IAvaTopicSubscription
 */
async function persistSubscriptionInDataHierarchyTable(subscription: IAvaTopicSubscription): Promise<void> {
  const putParams: DDB.DocumentClient.PutItemInput = {
    TableName: DATA_HIERARCHY_TABLE_NAME,
    Item: {
      ...subscription,
      id: subscription.endpoint,
      type: 'ISSUE_TOPIC_SUBSCRIPTION'
    }
  };

  logger.log(LogLevel.VERBOSE, 'Putting subscription', JSON.stringify(putParams, null, 2));
  const resp = await ddbDocClient.put(putParams).promise();
  logger.log(LogLevel.VERBOSE, 'Put subscription response', JSON.stringify(resp, null, 2));
}

/**
 * Updates the subscription for the supplied subscriptionArn with the supplied filter policy
 * @param subscription IAvaTopicSubscription
 */
async function updateSubscriptionFilterPolicy(subscription: IAvaTopicSubscription): Promise<void> {
  try {
    const subscriptionUpdateParams: SNS.SetSubscriptionAttributesInput = {
      SubscriptionArn: subscription.subscriptionArn,
      AttributeName: 'FilterPolicy',
      AttributeValue: JSON.stringify(subscription.filterPolicy)
    };

    logger.log(LogLevel.VERBOSE, 'Updating subscription attributes', JSON.stringify(subscriptionUpdateParams, null, 2));
    const subscriptionUpdateResponse = await snsClient.setSubscriptionAttributes(subscriptionUpdateParams).promise();
    logger.log(LogLevel.VERBOSE, 'Update subscription response', JSON.stringify(subscriptionUpdateResponse, null, 2));
  } catch (err) {
    logger.log(LogLevel.WARN, 'Encountered an error while updating the subscription\'s filter policy', JSON.stringify(err, null, 2));

    // Re-throw the error if it's not something we will specifically handle
    if (err.statusCode !== 404) {
      logger.log(LogLevel.ERROR, 'Unable to update subscription', err);
      throw err;
    }

    // If the error code is 'NotFound' (404), the subscription we tried to update does not exist. Create a new
    // subscription and persist that ARN
    logger.log(LogLevel.INFO, 'Unable to update the previous subscription filter. Creating a new subscription with the new filter policy');
    const subscriptionArn = await subscribeToIssueNotificationTopic(subscription);

    // Update the subscription object with the newly created SubscriptionArn
    subscription.subscriptionArn = subscriptionArn;
  }
}

/**
 * Checks if a previous version of this event had subscribers that are no longer subscribed. For those,
 * change the filter policy for the AVA topic subscription to remove this event ID
 * @param currentSubscriptionsForEvent List of subscriptions for the current event creation/update
 * @param previousSms Comma-separated string of phone numbers that were previously subscribed to the event
 * @param previousEmail Comma-separated string of email addresses that were previously subscribed to the event
 * @param eventId The current event ID
 */
async function cleanupPreviousSubscriptions(currentSubscriptionsForEvent: IAvaTopicSubscription[], previousSms: string, previousEmail: string, eventId: string): Promise<void> {
  logger.log(LogLevel.INFO, 'Checking if event had previous subscriptions that need to be cleaned');

  const subscriptionsToClean: IAvaTopicSubscription[] = [];

  if (previousEmail) {
    for (const email of previousEmail.split(',')) {
      // Check if previous email subscription is not included in the current list of subscriptions
      if (!currentSubscriptionsForEvent.some(s => s.protocol === SubscriptionProtocols.EMAIL && s.endpoint === email.trim())) {
        subscriptionsToClean.push({ protocol: SubscriptionProtocols.EMAIL, endpoint: email.trim() })
      }
    }
  }

  if (previousSms) {
    for (const phoneNumber of previousSms.split(',')) {
      // Check if previous phone number subscription is not included in the current list of subscriptions
      if (!currentSubscriptionsForEvent.some(s => s.protocol === SubscriptionProtocols.SMS && s.endpoint === phoneNumber.trim())) {
        subscriptionsToClean.push({ protocol: SubscriptionProtocols.SMS, endpoint: phoneNumber.trim() })
      }
    }
  }

  logger.log(LogLevel.INFO, `Found ${subscriptionsToClean.length} subscription(s) to clean`);

  for (let i = 0; i < subscriptionsToClean.length; i++) {
    logger.log(LogLevel.INFO, `Handling #${i + 1} of ${subscriptionsToClean.length} subscription(s) to clean`);

    const subscription = await getSubscriptionFromDataHierarchyTable(subscriptionsToClean[i]);
    if (subscription && subscription.filterPolicy) {
      const eventIdIndex = subscription.filterPolicy.eventId.findIndex(e => e === eventId);

      if (eventIdIndex > -1) {
        // Remove the event ID from the existing filter policy
        subscription.filterPolicy.eventId.splice(eventIdIndex, 1);

        await updateSubscriptionFilterPolicy(subscription);
        await persistSubscriptionInDataHierarchyTable(subscription);
      } else {
        logger.log(LogLevel.WARN, 'Previous subscription from data hierarchy table did not include the current event ID');
        logger.log(LogLevel.VERBOSE, 'Previous subscription from data hierarchy table', JSON.stringify(subscription, null, 2));
      }
    } else {
      logger.log(LogLevel.WARN, 'Previous subscription either did not exist in the data hierarchy table or there was no filter policy');
      logger.log(LogLevel.VERBOSE, 'Previous subscription from data hierarchy table', JSON.stringify(subscription, null, 2));
    }
  }
}

/**
 * Retrieves counts of the issues for the past 24 hours to be shown on the Overview page
 * @returns IGetPrevDayIssuesStatsOutput
 */
async function getPrevDayIssuesStats(): Promise<IGetPrevDayIssuesStatsOutput> {
  const output: IGetPrevDayIssuesStatsOutput = {
    acknowledged: 0,
    closed: 0,
    open: 0,
    lastThreeHours: 0
  };

  const dateFormat = 'YYYY-MM-DD';
  const today = moment.utc();
  const yesterday = today.clone().subtract(24, 'hours');
  const threeHoursAgo = today.clone().subtract('3', 'hours');
  const dateStrings = [yesterday.format(dateFormat), today.format(dateFormat)];

  for (const dateString of dateStrings) {
    logger.log(LogLevel.INFO, `Retrieving Issues stats for ${dateString}`);

    const queryParams: DDB.DocumentClient.QueryInput = {
      TableName: ISSUES_TABLE_NAME,
      IndexName: 'ByCreatedDate-index',
      KeyConditionExpression: '#ds = :ds and #ca >= :ca',
      ExpressionAttributeNames: {
        '#ds': 'createdDateUtc',
        '#ca': 'createdAt'
      },
      ExpressionAttributeValues: {
        ':ds': dateString,
        ':ca': yesterday.toISOString()
      }
    };

    do {
      logger.log(LogLevel.VERBOSE, 'Querying Issues table', JSON.stringify(queryParams, null, 2));
      const resp = await ddbDocClient.query(queryParams).promise();

      if (resp.Items) {
        for (const item of resp.Items) {
          switch (item.status) {
            case 'closed':
              output.closed += 1;
              break;
            case 'open':
              output.open += 1;
              break;
            case 'acknowledged':
              output.acknowledged += 1;
              break;
          }

          if (item.createdAt >= threeHoursAgo.toISOString()) {
            output.lastThreeHours += 1;
          }
        }
      }

      queryParams.ExclusiveStartKey = resp.LastEvaluatedKey;
    } while (queryParams.ExclusiveStartKey)
  }

  return output;
}

/**
 * Creates a new subscription to the Issue Notification Topic and returns the ARN for the new subscription
 * @param subscription Object of type IAvaTopicSubscription
 * @returns Subscription ARN
 */
async function subscribeToIssueNotificationTopic(subscription: IAvaTopicSubscription): Promise<string> {
  const subscribeParams: SNS.SubscribeInput = {
    TopicArn: ISSUE_NOTIFICATION_TOPIC_ARN,
    Protocol: subscription.protocol,
    Endpoint: subscription.endpoint,
    Attributes: { FilterPolicy: JSON.stringify(subscription.filterPolicy) },
    ReturnSubscriptionArn: true
  };

  logger.log(LogLevel.VERBOSE, 'Creating subscription', JSON.stringify(subscribeParams, null, 2));
  const subscribeResponse = await snsClient.subscribe(subscribeParams).promise();
  logger.log(LogLevel.VERBOSE, 'Create subscription response', JSON.stringify(subscribeResponse, null, 2));

  return subscribeResponse.SubscriptionArn;
}