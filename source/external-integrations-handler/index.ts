// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
import { getOptions } from '../solution-utils/get-options';
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';
import { IS3Request, IIotMessage, IPublishIssueParams } from './lib/utils';
import { v4 as uuidV4 } from 'uuid';

// Import AWS SDK
import S3 from 'aws-sdk/clients/s3';
import Ddb from 'aws-sdk/clients/dynamodb';
import IotData from 'aws-sdk/clients/iotdata';

const { AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL, ISSUES_TABLE, DATA_HIERARCHY_TABLE, IOT_ENDPOINT_ADDRESS, ISSUES_TOPIC, IOT_MESSAGE_NAME_DELIMITER } = process.env;

const awsSdkOptions = getOptions();
const s3Client = new S3(awsSdkOptions);
const ddbDocClient = new Ddb.DocumentClient(awsSdkOptions);
const iotDataClient = new IotData(getOptions({ endpoint: IOT_ENDPOINT_ADDRESS }));
const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

/**
 * Request handler.
 */
export async function handler(event: any): Promise<any> {
  logger.log(LogLevel.INFO, 'Received event', JSON.stringify(event, null, 2));

  // Ensure this handler supports the incoming handler event input. Make a copy
  // of the event input so manipulations during validation do not impact processing
  validateHandlerInput(JSON.parse(JSON.stringify(event)));

  if (event.Records) {
    await handleS3Event(event as IS3Request);
  } else {
    await handleIotMessage(event as IIotMessage);
  }
}

/**
 * Validates that the input to this handler can be properly handled
 * @param event Handler input payload
 */
function validateHandlerInput(event: any): void {
  if (!event) {
    logger.log(LogLevel.ERROR, 'Event input was null or undefined');
    throw new Error('Invalid handler input');
  }

  if (!event.Records) {
    validateIotMessageInput(event as IIotMessage);
  }
}

function validateIotMessageInput(event: IIotMessage) {
  if (!event.messages) {
    throw new Error('Event did not include an array of messages');
  }

  const msg = event.messages.pop();
  for (const requiredProperty of ['name', 'value', 'timestamp']) {
    if (!msg[requiredProperty]) {
      throw new Error(`Message was missing the '${requiredProperty}' property`);
    }
  }

  if (msg.name.split(IOT_MESSAGE_NAME_DELIMITER).length < 2) {
    throw new Error(`Message name could not be split by the '${IOT_MESSAGE_NAME_DELIMITER}' character`);
  }
}

/**
 * Handles messages that were published to the IoT devices topic
 * @param event Message that was published to the IoT Topic
 */
async function handleIotMessage(event: IIotMessage): Promise<void> {
  try {
    logger.log(LogLevel.INFO, 'Handling message posted to IoT devices topic');

    // Derive the tag name and machine ID from the individual message we will process
    const msg = event.messages.pop();
    const splitMsgName = msg.name.split(IOT_MESSAGE_NAME_DELIMITER);
    const tagName = splitMsgName.pop();
    const machineName = splitMsgName.join(IOT_MESSAGE_NAME_DELIMITER);
    logger.log(LogLevel.VERBOSE, `Derived tag name (${tagName}) and machine name (${machineName}) from the message`);

    const device = await getDevice(machineName);
    if (!device) {
      throw new Error(`Unable to match machine name (${machineName}) to a Device in Amazon Virtual Andon`);
    }

    const avaEvent = await getEvent(`${tagName}_${msg.value}`);
    if (!avaEvent) {
      throw new Error(`Unable to match '${tagName}_${msg.value}' to an Event in Amazon Virtual Andon`);
    }

    if (await hasUnresolvedIssueForEventAndDevice(avaEvent.id, device.name)) {
      throw new Error('An unresolved issue exists for this event on this device');
    }

    const dataHierarchyItems = await getDataHierarchyItems(device, avaEvent);

    await publishToIssuesTopic({
      eventId: avaEvent.id,
      eventDescription: avaEvent.name,
      priority: avaEvent.priority,
      areaName: dataHierarchyItems.area.name,
      deviceName: device.name,
      issueSource: 'device',
      createdBy: 'device',
      processName: dataHierarchyItems.process.name,
      siteName: dataHierarchyItems.site.name,
      stationName: dataHierarchyItems.station.name
    });
  } catch (err) {
    logger.log(LogLevel.ERROR, 'Unable to process message', err);
  }
}

/**
 * Handles events from S3 that invoke this Lambda function when an object is put in the bucket
 * @param event Event from S3 that contains an array of records to process
 */
async function handleS3Event(event: IS3Request): Promise<void> {
  // Process each record in the array
  let processedRecords = 0;

  for (const record of event.Records) {
    try {
      logger.log(LogLevel.INFO, `Processing record #${processedRecords + 1} of ${event.Records.length} total record(s)`);

      if (record.eventSource === 'aws:s3' && record.eventName && record.eventName.startsWith('ObjectCreated:')) {
        const bucketName = record.s3.bucket.name;
        const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        const getObjectParams: S3.GetObjectRequest = { Bucket: bucketName, Key: objectKey };
        logger.log(LogLevel.VERBOSE, 'Getting object from S3', JSON.stringify(getObjectParams, null, 2));
        const s3Obj = await s3Client.getObject(getObjectParams).promise();

        // The object in S3 might have several JSON objects on each line. We'll trim the file of whitespace,
        // split the string on the new line character parse them into an array of individual objects
        const anomalyObjects = s3Obj.Body.toString('utf-8')
          .trim()
          .split('\n')
          .map((x: any) => JSON.parse(x));
        logger.log(LogLevel.VERBOSE, 'Anomaly objects', JSON.stringify(anomalyObjects, null, 2));

        // Find an item in the array of anomaly objects that contains a `diagnostics` array, which should contain
        // a machine ID
        const idx = anomalyObjects.findIndex(x => x.diagnostics);
        if (idx > -1) {
          // Each item in the diagnostics array should contain a `name` property. The format will be:
          // machine-id\\sensor-id so we will split the name on the `\` character to extract the machine ID
          const machineId = anomalyObjects[idx].diagnostics[0].name.split('\\')[0];
          logger.log(LogLevel.VERBOSE, `Machine ID: ${machineId}`);

          // Process the last element in the anomaly array, which should represent the most recent data
          await processS3ObjectData(machineId, anomalyObjects[anomalyObjects.length - 1]);
        } else {
          logger.log(LogLevel.INFO, 'Skipping record as none of the objects had any diagnostic information');
        }
      }

      processedRecords++;
    } catch (err) {
      logger.log(LogLevel.ERROR, 'Unable to process record', err);
    }
  }

  if (processedRecords === event.Records.length) {
    logger.log(LogLevel.INFO, 'Successfully processed all record(s)');
  } else {
    logger.log(LogLevel.WARN, `${event.Records.length - processedRecords} record(s) were not successfully processed`);
  }
}

/**
 * Processes the object that was put in the S3 bucket and if needed, publishes a message to the AVA Issues topic
 * @param {string} machineId ID of the machine for which this anomaly data was generated
 * @param {any} s3ObjData Parsed JSON from the object in S3
 * @returns {any} AppSync response
 */
async function processS3ObjectData(machineId: string, s3ObjData: any): Promise<any> {
  if (!machineId || machineId.trim() === '') {
    throw new Error('Machine ID was not supplied');
  }

  if (!s3ObjData.hasOwnProperty('prediction')) {
    throw new Error('Anomaly data did not contain a prediction score');
  }

  if (s3ObjData.prediction === 0) {
    logger.log(LogLevel.INFO, 'No anomaly detected');
  }

  if (!s3ObjData.diagnostics) {
    throw new Error('Anomaly data did not contain diagnostic information');
  }

  logger.log(LogLevel.INFO, `Using machine ID (${machineId}) to look up device`);
  const device = await getDevice(machineId);
  if (!device) {
    throw new Error(`Unable to match machine ID (${machineId}) to a Device in Amazon Virtual Andon`);
  }

  const station = await getDataHierarchyItemByIdAndType(device.parentId, 'STATION');
  if (!station) {
    throw new Error(`Unable to find station by ID (${device.parentId})`);
  }

  const area = await getDataHierarchyItemByIdAndType(station.parentId, 'AREA');
  if (!area) {
    throw new Error(`Unable to find area by ID (${station.parentId})`);
  }

  const site = await getDataHierarchyItemByIdAndType(area.parentId, 'SITE');
  if (!site) {
    throw new Error(`Unable to find site by ID (${area.parentId})`);
  }

  const processes = await getDataHierarchyItemsByTypeAndParentId('PROCESS', area.id);
  if (processes.length === 0) {
    throw new Error(`Unable to find any processes under Area (${area.name}: ${area.description})`);
  }

  const events: Ddb.DocumentClient.AttributeMap[] = [];
  for (const process of processes) {
    events.push(...await getDataHierarchyItemsByTypeAndParentId('EVENT', process.id));
  }

  const automatedEvent = events.find(e => e.eventType && e.eventType.trim().toLowerCase() === 'automated');
  if (!automatedEvent) {
    throw new Error(`Unable to find any automated events under Area (${area.name}: ${area.description})`);
  }

  if (await hasUnresolvedIssueForEventAndDevice(automatedEvent.id, device.name)) {
    throw new Error('An unresolved issue exists for this event on this device');
  }

  await publishToIssuesTopic({
    eventId: automatedEvent.id,
    eventDescription: automatedEvent.name,
    priority: automatedEvent.priority,
    deviceName: device.name,
    stationName: station.name,
    areaName: area.name,
    siteName: site.name,
    processName: (processes.find(p => p.id === automatedEvent.parentId)).name,
    issueSource: 's3File',
    createdBy: 'automatic-issue-detection',
    additionalDetails: JSON.stringify(s3ObjData)
  });
}

/**
 * Returns an object containing the full data hierarchy for the supplied event and device
 * @param device Device that was matched to the incoming Lambda input
 * @param event Event that was matched to the incoming Lambda input
 */
async function getDataHierarchyItems(device: any, event: any) {
  const output: any = {};

  output.station = await getDataHierarchyItemByIdAndType(device.parentId, 'STATION');
  if (!output.station) {
    throw new Error(`Unable to find station by ID (${device.parentId})`);
  }

  output.area = await getDataHierarchyItemByIdAndType(output.station.parentId, 'AREA');
  if (!output.area) {
    throw new Error(`Unable to find area by ID (${output.station.parentId})`);
  }

  output.site = await getDataHierarchyItemByIdAndType(output.area.parentId, 'SITE');
  if (!output.site) {
    throw new Error(`Unable to find site by ID (${output.area.parentId})`);
  }

  output.process = await getDataHierarchyItemByIdAndType(event.parentId, 'PROCESS');
  if (!output.process) {
    throw new Error(`Unable to find process by ID (${event.parentId})`);
  }

  if (output.process.parentId !== output.station.parentId) {
    throw new Error('Process and Station must be under the same Area');
  }

  return output;
}

/**
 * Returns the device by matching the machine ID to a device ID or device alias
 * @param machineId The ID for the machine reporting the issue
 */
async function getDevice(machineId: string): Promise<Ddb.DocumentClient.AttributeMap> {
  let device: Ddb.DocumentClient.AttributeMap;
  device = await getDataHierarchyItemByIdAndType(machineId, 'DEVICE');
  if (device) {
    return device;
  }

  // The machine ID did not match a device ID so check to see if any devices have 
  // the machine ID as an alias
  const queryParams: Ddb.DocumentClient.QueryInput = {
    TableName: DATA_HIERARCHY_TABLE,
    IndexName: 'ByTypeAndParent-index',
    KeyConditionExpression: '#type = :type',
    FilterExpression: '#alias = :alias',
    ExpressionAttributeNames: { '#type': 'type', '#alias': 'alias' },
    ExpressionAttributeValues: { ':type': 'DEVICE', ':alias': machineId }
  };

  do {
    logger.log(LogLevel.VERBOSE, 'Querying', JSON.stringify(queryParams, null, 2));
    const resp = await ddbDocClient.query(queryParams).promise();
    logger.log(LogLevel.VERBOSE, 'Query response', JSON.stringify(resp, null, 2));
    if (resp.Items) {
      device = resp.Items[0];
    }

    queryParams.ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (!device && queryParams.ExclusiveStartKey);

  return device;
}

/**
 * Returns the event by matching the supplied ID to an event ID or an event with that as its alias
 * @param eventId The event ID or alias to look up
 */
async function getEvent(eventId: string): Promise<Ddb.DocumentClient.AttributeMap> {
  let event: Ddb.DocumentClient.AttributeMap;
  event = await getDataHierarchyItemByIdAndType(eventId, 'EVENT');
  if (event) {
    return event;
  }

  // The ID did not match an event ID so check to see if any events have 
  // the ID as an alias
  const queryParams: Ddb.DocumentClient.QueryInput = {
    TableName: DATA_HIERARCHY_TABLE,
    IndexName: 'ByTypeAndParent-index',
    KeyConditionExpression: '#type = :type',
    FilterExpression: '#alias = :alias',
    ExpressionAttributeNames: { '#type': 'type', '#alias': 'alias' },
    ExpressionAttributeValues: { ':type': 'EVENT', ':alias': eventId }
  };

  do {
    logger.log(LogLevel.VERBOSE, 'Querying', JSON.stringify(queryParams, null, 2));
    const resp = await ddbDocClient.query(queryParams).promise();
    logger.log(LogLevel.VERBOSE, 'Query response', JSON.stringify(resp, null, 2));
    if (resp.Items) {
      event = resp.Items[0];
    }

    queryParams.ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (!event && queryParams.ExclusiveStartKey);

  return event;
}

/**
 * Queries the IssueTable's "ByDeviceEvent-index" global secondary index to determine if there is already
 * an existing issue for this event + device combination
 * @param {string} eventId 
 * @param {string} deviceName 
 * @returns {boolean}
 */
async function hasUnresolvedIssueForEventAndDevice(eventId: string, deviceName: string): Promise<boolean> {
  let foundUnresolvedIssue = false;

  const queryParams: Ddb.DocumentClient.QueryInput = {
    TableName: ISSUES_TABLE,
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
    const resp = await ddbDocClient.query(queryParams).promise();
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
async function getItemFromDDBTable(TableName: string, Key: any): Promise<Ddb.DocumentClient.AttributeMap> {
  const params: Ddb.DocumentClient.GetItemInput = { TableName, Key };

  logger.log(LogLevel.VERBOSE, 'Getting item from table', JSON.stringify(params, null, 2));
  const resp = await ddbDocClient.get(params).promise();
  logger.log(LogLevel.VERBOSE, 'Get item response', JSON.stringify(resp, null, 2));
  return resp.Item;
}

/**
 * Returns the data hierarchy item matching the supplied ID and type
 * @param id The ID of the data hierarchy item
 * @param type The type of the data hierarchy item
 */
async function getDataHierarchyItemByIdAndType(id: string, type: string): Promise<Ddb.DocumentClient.AttributeMap> {
  logger.log(LogLevel.INFO, `Getting ${type} by id (${id})`);
  return getItemFromDDBTable(DATA_HIERARCHY_TABLE, { id, type });
}

/**
 * Returns a list of data hierarchy items matching the supplied type and with the supplied parent ID
 * @param type The type of data hierarchy items
 * @param parentId The parent ID of the data hierarchy items
 */
async function getDataHierarchyItemsByTypeAndParentId(type: string, parentId: string): Promise<Ddb.DocumentClient.AttributeMap[]> {
  logger.log(LogLevel.INFO, `Getting ${type} item(s) by Parent ID (${parentId})`);

  const output: Ddb.DocumentClient.AttributeMap[] = [];
  const queryParams: Ddb.DocumentClient.QueryInput = {
    TableName: DATA_HIERARCHY_TABLE,
    IndexName: 'ByTypeAndParent-index',
    KeyConditionExpression: '#type = :type and #parentId = :parentId',
    ExpressionAttributeNames: { '#type': 'type', '#parentId': 'parentId' },
    ExpressionAttributeValues: { ':type': type, ':parentId': parentId }
  };

  do {
    logger.log(LogLevel.VERBOSE, 'Querying', JSON.stringify(queryParams, null, 2));
    const resp = await ddbDocClient.query(queryParams).promise();
    logger.log(LogLevel.VERBOSE, 'Query response', JSON.stringify(resp, null, 2));

    if (resp.Items) {
      output.push(...resp.Items);
    }

    queryParams.ExclusiveStartKey = resp.LastEvaluatedKey;
  } while (queryParams.ExclusiveStartKey);
  return output;
}

/**
 * Publishes a message to the AVA Issues topic so an issue will be created
 * @param props Object containing required properties for creating an AVA Issue
 */
async function publishToIssuesTopic(props: IPublishIssueParams): Promise<void> {
  const publishParams: IotData.PublishRequest = {
    topic: ISSUES_TOPIC,
    payload: JSON.stringify({
      id: uuidV4(),
      eventId: props.eventId,
      eventDescription: props.eventDescription,
      priority: props.priority,
      deviceName: props.deviceName,
      stationName: props.stationName,
      areaName: props.areaName,
      siteName: props.siteName,
      processName: props.processName,
      status: 'open',
      created: new Date().toISOString(),
      issueSource: props.issueSource,
      createdBy: props.createdBy,
      additionalDetails: props.additionalDetails
    })
  };
  logger.log(LogLevel.INFO, 'Publishing to create issue');

  logger.log(LogLevel.VERBOSE, 'Publish params', JSON.stringify(publishParams, null, 2));
  await iotDataClient.publish(publishParams).promise();
}
