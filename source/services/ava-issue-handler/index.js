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

/**
 * @author Solution Builders
 */

/* Amplify Params - DO NOT EDIT
You can access the following resource attributes as environment variables from your Lambda function
var environment = process.env.ENV
var region = process.env.REGION

Amplify Params - DO NOT EDIT */

require('isomorphic-fetch');
const AWS = require('aws-sdk');
const AUTH_TYPE = require('aws-appsync/lib/link/auth-link').AUTH_TYPE;
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');

let config = {
  region: process.env.AWS_REGION,
  auth: {
    type: AUTH_TYPE.AWS_IAM,
    credentials: AWS.config.credentials,
  },
  disableOffline: true
};

const createIssue = `mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
    id
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
}
`;

const updateIssue = `mutation UpdateIssue($input: UpdateIssueInput!) {
  updateIssue(input: $input) {
    id
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
}
`;

const parameterStore = new AWS.SSM()

const getParam = param => {
  return new Promise((res, rej) => {
    parameterStore.getParameter({
      Name: param,
      WithDecryption: true
    }, (err, data) => {
      if (err) {
        return rej(err)
      }
      return res(data)
    })
  })
}

exports.handler = (event, context, callback) => {
  const CreateIssueInput = event;
  (async () => {
    try {
      let result;
      const param = await getParam(process.env.API_ENDPOINT);
      config['url'] = param['Parameter']['Value'];
      const client = new AWSAppSyncClient(config);
      //If this is a new issue, create issue in DB and send notification to SNS Topic
      if (CreateIssueInput.status == 'open') {
        result = await client.mutate({
          mutation: gql(createIssue),
          variables: { input: CreateIssueInput }
        });
        // Create publish parameters
        const messageToSend = CreateIssueInput.eventDescription + " has been created at " + CreateIssueInput.deviceName;

        // TO:DO - Create topic dynamically
        const topicARN = "arn:aws:sns:" + process.env.AWS_REGION + ":" + process.env.ACCOUNT_ID + ":andon-" + CreateIssueInput.eventDescription
        var params = {
          Message: messageToSend, /* required */
          TopicArn: topicARN
        };
        // Create promise and SNS service object
        var publishTextPromise = new AWS.SNS({ apiVersion: '2010-03-31' }).publish(params).promise();

        // Handle promise's fulfilled/rejected states
        publishTextPromise.then(
          function (data) {
            console.log("Message sent to the topic");
            console.log("MessageID is " + data.MessageId);
          }).catch(
            function (err) {
              console.log(err, err.stack);
              throw err;
            });
      } else {
        result = await client.mutate({
          mutation: gql(updateIssue),
          variables: { input: CreateIssueInput }
        });
      }

      callback(null, result.data);
    } catch (e) {
      console.log('Error sending mutation: ', e);
      callback(Error(e));
    }
  })().catch(e => { console.error(e) });
};