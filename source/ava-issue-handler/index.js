// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

require('isomorphic-fetch');
const AUTH_TYPE = require('aws-appsync-auth-link/lib/auth-link').AUTH_TYPE;
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');
const uuid = require('uuid');
const { getOptions } = require('solution-utils');

const AWS = require('aws-sdk');
const awsSdkOptions = getOptions();
const SNS = new AWS.SNS(awsSdkOptions);
const S3 = new AWS.S3(awsSdkOptions);
const docClient = new AWS.DynamoDB.DocumentClient(awsSdkOptions);

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

let appsyncClient;

const { AWS_REGION, API_ENDPOINT } = process.env;
const { EVENT_TABLE, DEVICE_TABLE, STATION_TABLE, AREA_TABLE, SITE_TABLE, PROCESS_TABLE, ISSUE_TABLE } = process.env;

/**
 * Handler function.
 */
exports.handler = async (event) => {
  console.log('Event', JSON.stringify(event, null, 2));

  try {
    if (!appsyncClient) {
      const config = {
        region: AWS_REGION,
        auth: {
          type: AUTH_TYPE.AWS_IAM,
          credentials: AWS.config.credentials
        },
        disableOffline: true,
        url: API_ENDPOINT
      };
      appsyncClient = new AWSAppSyncClient(config);
    }

    let result;

    if (!event.Records) {
      // If `Records` is not present in the event, process this message as if it was retrieved from the IoT Topic
      const topicArn = event.topicArn;
      delete event.topicArn;

      if (event.status === 'open') {
        // Mutate a new issue
        result = await doAppSyncMutation(createIssue, { input: { ...event, issueSource: 'webClient' } });

        // Publish SNS message When SNS topic exists.
        if (topicArn && topicArn !== '') {
          await sendMessageToSnsTopic(topicArn, event.eventDescription, event.deviceName);
        }
      } else {
        // Mutate an updated issue
        result = await doAppSyncMutation(updateIssue, { input: event });
      }
    } else {
      // If `Records` is present in the event, process record in the array
      let totalRecords = 0;
      let processedRecords = 0;
      result = { data: [] };

      for (const record of event.Records) {
        totalRecords++;

        try {
          if (record.eventSource === 'aws:s3' && record.eventName && record.eventName.startsWith('ObjectCreated:')) {
            const bucketName = record.s3.bucket.name;
            const objectKey = record.s3.object.key;

            const s3Obj = await S3.getObject({ Bucket: bucketName, Key: objectKey }).promise();
            const s3ObjData = JSON.parse(s3Obj.Body.toString('utf-8'));
            result.data.push(await processS3ObjectData(s3ObjData));
          }

          processedRecords++;
        } catch (err) {
          console.error('Unable to process record');
          console.error(err);
        }
      }

      console.log(`Successfully processed ${processedRecords} of ${totalRecords} record(s)`);
    }

    return result.data;
  } catch (error) {
    console.error(error);
    return error;
  }
}

/**
 * Uses the AppSync client to perform the supplied mutation with the supplied variables
 * @param {string} mutationGql 
 * @param {object} variables 
 * @returns {object} AppSync response
 */
async function doAppSyncMutation(mutationGql, variables) {
  return await appsyncClient.mutate({
    mutation: gql(mutationGql),
    variables
  });
}

/**
 * Publishes a message on the supplied Topic ARN to notify that an issue has been created for this device
 * @param {string} topicArn 
 * @param {string} eventDescription 
 * @param {string} deviceName 
 */
async function sendMessageToSnsTopic(topicArn, eventDescription, deviceName) {
  const messageToSend = `${eventDescription} has been created at ${deviceName}.`;
  const snsParams = {
    Message: messageToSend,
    TopicArn: topicArn
  };

  const snsResponse = await SNS.publish(snsParams).promise();
  console.log(`Message sent to the topic: ${snsResponse.MessageId}`);
}

/**
 * Parses the object that was put in the S3 bucket and creates a new issue
 * @param {*} s3ObjData 
 * @returns {object} AppSync response
 */
async function processS3ObjectData(s3ObjData) {
  if (!s3ObjData.eventId || s3ObjData.eventId.trim() === '') {
    throw new Error('Anomaly data was missing required parameter: eventId');
  }

  if (!s3ObjData.deviceId || s3ObjData.deviceId.trim() === '') {
    throw new Error('Anomaly data was missing required parameter: deviceId');
  }

  const { eventId, deviceId } = s3ObjData;

  const eventData = await getItemFromDDBTable(EVENT_TABLE, { id: eventId });
  if (!eventData) {
    throw new Error(`Unable to retrieve event data for ID: ${eventId}`);
  }

  const deviceData = await getItemFromDDBTable(DEVICE_TABLE, { id: deviceId });
  if (!deviceData) {
    throw new Error(`Unable to retrieve device data for ID: ${deviceId}`);
  }

  if (await hasUnresolvedIssueForEventAndDevice(eventId, deviceData.name)) {
    throw new Error('An unresolved issue exists for this event on this device');
  }

  const stationId = deviceData.deviceStationId;
  const stationData = await getItemFromDDBTable(STATION_TABLE, { id: stationId });
  if (!stationData) {
    throw new Error(`Unable to retrieve station data for ID: ${stationId}`);
  }

  const areaId = stationData.stationAreaId;
  const areaData = await getItemFromDDBTable(AREA_TABLE, { id: areaId });
  if (!areaData) {
    throw new Error(`Unable to retrieve area data for ID: ${areaId}`);
  }

  const siteId = areaData.areaSiteId;
  const siteData = await getItemFromDDBTable(SITE_TABLE, { id: siteId });
  if (!siteData) {
    throw new Error(`Unable to retrieve site data for ID: ${siteId}`);
  }

  const processId = eventData.eventProcessId;
  const processData = await getItemFromDDBTable(PROCESS_TABLE, { id: processId });
  if (!processData) {
    throw new Error(`Unable to retrieve process data for ID: ${processId}`);
  }

  const appSyncResponse = await doAppSyncMutation(createIssue, {
    input: {
      id: uuid.v4(),
      eventId,
      eventDescription: eventData.name,
      priority: eventData.priority,
      deviceName: deviceData.name,
      stationName: stationData.name,
      areaName: areaData.name,
      siteName: siteData.name,
      processName: processData.name,
      status: 'open',
      created: new Date().toISOString(),
      issueSource: 's3File'
    }
  });

  if (eventData.topicArn && eventData.topicArn.trim() !== '') {
    await sendMessageToSnsTopic(eventData.topicArn, eventData.description, deviceData.name);
  }

  return appSyncResponse;
}

/**
 * Queries the IssueTable's "ByDeviceEvent-index" global secondary index to determine if there is already
 * an existing issue for this event + device combination
 * @param {string} eventId 
 * @param {string} deviceName 
 * @returns {boolean}
 */
async function hasUnresolvedIssueForEventAndDevice(eventId, deviceName) {
  let foundUnresolvedIssue = false;

  const queryParams = {
    TableName: ISSUE_TABLE,
    IndexName: 'ByDeviceEvent-index',
    KeyConditionExpression: '#hashKey = :hashKey',
    FilterExpression: 'attribute_not_exists(#closed)',
    ExpressionAttributeNames: {
      '#hashKey': 'deviceName#eventId',
      '#closed': 'closed'
    },
    ExpressionAttributeValues: {
      ':hashKey': `${deviceName}#${eventId}`,
    }
  };

  do {
    const resp = await docClient.query(queryParams).promise();
    foundUnresolvedIssue = (resp.Items && resp.Items.length > 0);
    queryParams.ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (!foundUnresolvedIssue && queryParams.ExclusiveStartKey);

  return foundUnresolvedIssue;
}

/**
 * Returns item with the supplied key from the supplied DynamoDB Table
 * @param {string} TableName 
 * @param {object} Key 
 * @returns {object|undefined}
 */
async function getItemFromDDBTable(TableName, Key) {
  const resp = await docClient.get({ TableName, Key }).promise();
  return resp.Item;
}
