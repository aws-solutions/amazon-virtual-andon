/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

require('isomorphic-fetch');
const AWS = require('aws-sdk');
const AUTH_TYPE = require('aws-appsync-auth-link/lib/auth-link').AUTH_TYPE;
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');

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
    acknowledged
    closed
    resolutionTime
    acknowledgedTime
    status
    version
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
  }
}`;

const SNS = new AWS.SNS();

/**
 * Handler function.
 */
exports.handler = async (event) => {
  try {
    const topicArn = event.topicArn;
    delete event.topicArn;

    const config = {
      region: process.env.AWS_REGION,
      auth: {
        type: AUTH_TYPE.AWS_IAM,
        credentials: AWS.config.credentials
      },
      disableOffline: true,
      url: process.env.API_ENDPOINT
    };
    const client = new AWSAppSyncClient(config);

    let result;
    if (event.status === 'open') {
      // Mutate a new issue
      result = await client.mutate({
        mutation: gql(createIssue),
        variables: {
          input: event
        }
      });

      // Publish SNS message When SNS topic exists.
      if (topicArn && topicArn !== '') {
        const messageToSend = `${event.eventDescription} has been created at ${event.deviceName}.`;
        const snsParams = {
          Message: messageToSend,
          TopicArn: topicArn
        };

        const snsResponse = await SNS.publish(snsParams).promise();
        console.log(`Message sent to the topic: ${snsResponse.MessageId}`);
      }
    } else {
      // Mutate an updated issue
      result = await client.mutate({
        mutation: gql(updateIssue),
        variables: {
          input: event
        }
      });
    }

    return result.data;
  } catch (error) {
    console.error(error);
    return error;
  }
}