/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

'use strict';

const uuid = require('uuid');
const axios = require('axios');
const AWS = require('aws-sdk');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const ddb = new AWS.DynamoDB();
const documentClient = new DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const ITEMS_PER_PAGE = 25;
const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';
const MIGRATION_TOPIC_ARN = process.env.MigrationSnsTopicArn;

exports.handler = async (event, context) => {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const { RequestType, ResourceProperties, LogicalResourceId } = event;
  let response = {
    status: 'SUCCESS',
    data: {
      Message: ''
    }
  };

  try {
    if (RequestType === 'Create') {
      if (LogicalResourceId === 'SendAnonymousUsage') {
        const { SolutionId, Version } = ResourceProperties;
        response.data = await sendAnonymousUsage({ SolutionId, Version });
      } else {
        const { SourceTable, DestinationTable } = ResourceProperties;
        if (!SourceTable || SourceTable === '' || !DestinationTable || DestinationTable === '') {
          console.error('Please provide table names correctly.');

          response.data = { Message: 'Please provide table names correctly.' };
          await publishSnsNotification('Please provide table names correctly.', LogicalResourceId);
        } else {
          // Check if tables exists.
          let tableExists = true;
          try {
            await Promise.all([
              ddb.describeTable({ TableName: SourceTable }).promise(),
              ddb.describeTable({ TableName: DestinationTable }).promise()
            ]);
          } catch (error) {
            console.error('An error occurred while describing tables.', error);

            tableExists = false;
            response.data = { Message: 'An error occurred while describing tables. Please check the table names.' };
            await publishSnsNotification('An error occurred while describing tables. Please check the table names.', LogicalResourceId);
          }

          if (tableExists) {
            let count = 0;
            const scanParams = {
              TableName: SourceTable,
              Limit: ITEMS_PER_PAGE + 1
            };

            do {
              const scanResult = await documentClient.scan(scanParams).promise();
              const scanItems = scanResult.Items;

              if (scanItems.length === 0) {
                break;
              }

              scanParams.ExclusiveStartKey = scanResult.LastEvaluatedKey;

              if (scanItems.length === ITEMS_PER_PAGE + 1) {
                  const item = scanItems[ITEMS_PER_PAGE - 1];
                  for (let key in scanResult.LastEvaluatedKey) {
                    scanParams.ExclusiveStartKey[key] = item[key];
                  }
                  scanItems.pop();
              }

              const batchItems = [];
              for (const item of scanItems) {
                batchItems.push({
                  PutRequest: {
                    Item: item
                  }
                });
              }

              const batchWriteParams = {
                  RequestItems: {}
              };
              batchWriteParams.RequestItems[DestinationTable] = batchItems;
              const batchResult = await documentClient.batchWrite(batchWriteParams).promise();
              count = count + batchItems.length;

              console.log(`${count} item(s) migrated.`);
              console.log(JSON.stringify(batchResult, null, 2));
            } while (scanParams.ExclusiveStartKey);

            console.log(`Result for ${LogicalResourceId}: ${count} item(s) migrated.`);
            response.data = { Message: `${count} item(s) migrated.`};
            await publishSnsNotification(`${count} item(s) migrated.`, LogicalResourceId);
          }
        }
      }
    }
  } catch (error) {
    console.error('An error occurred.', error);
    await publishSnsNotification(`Failure happened. See the details in CloudWatch Log Stream: ${context.logStreamName}`, LogicalResourceId);

    response.data = { Message: error.message };
  } finally {
    await sendResponse(event, context.logStreamName, response);
  }

  return response;
};

/**
 * Send custom resource response.
 * @param {object} event - Custom resource event
 * @param {string} logStreamName - Custom resource log stream name
 * @param {object} response - Response object { status: "SUCCESS|FAILED", data: any }
 */
async function sendResponse(event, logStreamName, response) {
  const responseBody = JSON.stringify({
    Status: response.status,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
    PhysicalResourceId: logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.data,
  });

  console.log(`RESPONSE BODY: ${responseBody}`);

  const config = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  return await axios.put(event.ResponseURL, responseBody, config);
}

/**
 * Send anonymous usage.
 * @param {object} properties - Anonymous properties object { SolutionId: string, UUID: string, Version: String, Type: "Create|Update|Delete" }
 * @return {Promise} - Promise mesage object
 */
async function sendAnonymousUsage(properties) {
  const config = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  const data = {
    Solution: properties.SolutionId,
    TimeStamp: `${new Date().toISOString().replace(/T/, ' ')}`,
    UUID: uuid.v4(),
    Version: properties.Version,
    Data: {
      Region: process.env.AWS_REGION
    }
  };

  try {
    await axios.post(METRICS_ENDPOINT, data, config);
    return { Message: 'Anonymous data was sent successfully.' };
  } catch (error) {
    console.error('Error to send anonymous usage.');
    return { Message: 'Anonymous data was sent failed.' };
  }
}

/**
 * Publish Amazon SNS notificaiton to the provided mail.
 * @param {string} message
 * @param {string} logicalResourceId
 */
async function publishSnsNotification(message, logicalResourceId) {
  try {
    const response = await sns.publish({
      Message: message,
      Subject: `[Amazon Virtual Andon] Migration result for ${logicalResourceId}`,
      TopicArn: MIGRATION_TOPIC_ARN
    }).promise();

    console.log(`SNS publisehd: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.error('SNS publish failed.', error);
  }
}