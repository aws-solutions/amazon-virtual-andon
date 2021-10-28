// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

require('isomorphic-fetch');
import { AWSAppSyncClient, AUTH_TYPE, AWSAppSyncClientOptions } from 'aws-appsync';
import gql from 'graphql-tag';
import { getOptions } from '../solution-utils/get-options';
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';

import SNS from 'aws-sdk/clients/sns';
const awsSdkOptions = getOptions();
const sns = new SNS(awsSdkOptions);

const createIssue = `mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
    id
    eventId
    eventDescription
    type
    priority
    siteName
    processName
    areaName
    stationName
    deviceName
    created
    createdAt
    acknowledged
    closed
    resolutionTime
    acknowledgedTime
    status
    version
    issueSource
    additionalDetails
  }
}`;

const updateIssue = `mutation UpdateIssue($input: UpdateIssueInput!) {
  updateIssue(input: $input) {
    id
    eventId
    eventDescription
    type
    priority
    siteName
    processName
    areaName
    stationName
    deviceName
    created
    acknowledged
    closed
    resolutionTime
    acknowledgedTime
    status
    version
    comment
  }
}`;

let appsyncClient: AWSAppSyncClient<any>;

const { API_ENDPOINT, ISSUE_NOTIFICATION_TOPIC_ARN, LOGGING_LEVEL } = process.env;

// Available in the lambda runtime by default
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION, AWS_LAMBDA_FUNCTION_NAME } = process.env;

const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

/**
 * Handler function.
 */
export async function handler(event: IHandlerInput) {
  logger.log(LogLevel.INFO, 'Received event', JSON.stringify(event, null, 2));

  try {
    if (!appsyncClient) {
      const config: AWSAppSyncClientOptions = {
        region: AWS_REGION,
        auth: {
          type: AUTH_TYPE.AWS_IAM,
          credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
            sessionToken: AWS_SESSION_TOKEN
          }
        },
        disableOffline: true,
        url: API_ENDPOINT
      };
      appsyncClient = new AWSAppSyncClient(config);
    }

    let result: any;

    if (event.status === 'open') {
      // Mutate a new issue
      result = await doAppSyncMutation(createIssue, { input: { ...event, fullEventDescription: undefined } });

      // Publish SNS message to the issue notification topic
      await sendMessageToSnsTopic(event);
    } else {
      // Mutate an updated issue
      result = await doAppSyncMutation(updateIssue, { input: event });
    }

    return result.data;
  } catch (error) {
    logger.log(LogLevel.ERROR, error);
    return error;
  }
}

/**
 * Uses the AppSync client to perform the supplied mutation with the supplied variables
 * @param {string} mutationGql 
 * @param {object} variables 
 * @returns {object} AppSync response
 */
async function doAppSyncMutation(mutationGql: string, variables: any): Promise<any> {
  return appsyncClient.mutate({
    mutation: gql(mutationGql),
    variables
  });
}

/**
 * Publishes a message on the solution's Issue Notification Topic to notify that an issue has been created for this device
 * @param {IHandlerInput} eventData Event data for this Lambda function that contains properties used to construct the SNS message
 */
async function sendMessageToSnsTopic(eventData: IHandlerInput): Promise<void> {
  const snsParams: SNS.PublishInput = {
    MessageAttributes: {
      eventId: {
        DataType: 'String',
        StringValue: eventData.eventId
      }
    },
    Message: getSnsMessageString(eventData),
    TopicArn: ISSUE_NOTIFICATION_TOPIC_ARN
  };

  logger.log(LogLevel.VERBOSE, 'Publishing message', JSON.stringify(snsParams, null, 2));
  const snsResponse = await sns.publish(snsParams).promise();
  logger.log(LogLevel.INFO, `Message sent to the topic: ${snsResponse.MessageId}`);
}

/**
 * Returns a formatted string to be used as the SNS message body when publishing to the Issue Notification Topic
 * @param {IHandlerInput} eventData Event data for this Lambda function that contains properties used to construct the SNS message
 */
function getSnsMessageString(eventData: IHandlerInput): string {
  return [
    'The following Issue has been raised:',
    `Event: ${eventData.fullEventDescription || eventData.eventDescription}`,
    `Device: ${eventData.deviceName}`,
    '', 'Additional Details', '-----',
    `Site: ${eventData.siteName}`,
    `Area: ${eventData.areaName}`,
    `Process: ${eventData.processName}`,
    `Station: ${eventData.stationName}`
  ].join('\n')
}

interface IHandlerInput {
  id: string;
  eventId: string;
  eventDescription: string;
  fullEventDescription?: string;
  eventType?: string;
  priority: string;
  siteName: string;
  areaName: string;
  processName: string;
  stationName: string;
  deviceName: string;
  created: string;
  status: string;
  createdBy: string;
  issueSource: string;
}