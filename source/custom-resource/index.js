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

// Import packages
const uuid = require('uuid');
const axios = require('axios');

// Import AWS SDK
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const iot = new AWS.Iot();

// Declare constant variables
const WEB_CONFIG = `const andon_config = {
  "aws_project_region": "REGION",
  "aws_cognito_identity_pool_id": "COGNITO_IDENTITY_POOL_ID",
  "aws_cognito_region": "REGION",
  "aws_user_pools_id": "USER_POOLS_ID",
  "aws_user_pools_web_client_id": "USER_POOLS_WEB_CLIENT_ID",
  "oauth": {},
  "aws_appsync_graphqlEndpoint": "GRAPHQL_ENDPOINT",
  "aws_appsync_region": "REGION",
  "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
  "aws_iot_endpoint": "wss://IOT_ENDPOINT",
  "aws_iot_policy_name": "IOT_POLICY_NAME",
  "solutions_send_metrics": "SOLUTIONS_SEND_METRICS",
  "solutions_metrics_endpoint": "METRICS_ENDPOINT",
  "solutions_solutionId": "SOLUTION_ID",
  "solutions_solutionUuId": "SOLUTION_UUID",
  "solutions_version": "SOLUTION_VERION",
  "default_language": "DEFAULT_LANGUAGE"
};`;

// Metrics endpoint
const METRICS_ENDPOINT = 'https://metrics.awssolutionsbuilder.com/generic';
const METRICS_ENDPOINT_PAGE = 'https://metrics.awssolutionsbuilder.com/page';

/**
 * Request handler.
 */
exports.handler = async (event, context) => {
  console.log(`Received event: ${JSON.stringify(event)}`);

  const properties = event.ResourceProperties;
  let response = {
    status: 'SUCCESS',
    data: {},
  };

  try {
    switch (event.LogicalResourceId) {
      case 'CreateUuid':
        if (event.RequestType === 'Create') {
          response.data = { UUID: uuid.v4() };
        }
        break;
      case 'SendAnonymousUsage':
        const anonymousProperties = {
          ...properties,
          Type: event.RequestType
        };

        response.data = await sendAnonymousUsage(anonymousProperties);
        break;
      case 'CopyWebsite':
        if (['Create', 'Update'].includes(event.RequestType)) {
          const { SourceBucket, SourceKey, SourceManifest, DestinationBucket } = properties;
          try {
            response.data = await copyWebsite(SourceBucket, SourceKey, SourceManifest, DestinationBucket);
          } catch (error) {
            console.error(`Copying website asset failed.`);
            throw error;
          }
        }
        break;
      case 'PutWebsiteConfig':
        if (['Create', 'Update'].includes(event.RequestType)) {
          const iotEndpoint = await getIotEndpoint();
          const { S3Bucket, S3Key, ConfigItem } = properties;
          let configFile = WEB_CONFIG.replace(/REGION/g, process.env.AWS_REGION)
            .replace('COGNITO_IDENTITY_POOL_ID', ConfigItem.CognitoIdentityPoolId)
            .replace('USER_POOLS_ID', ConfigItem.UserPoolId)
            .replace('USER_POOLS_WEB_CLIENT_ID', ConfigItem.UserPoolClientWebId)
            .replace('GRAPHQL_ENDPOINT', ConfigItem.GraphQLEndpoint)
            .replace('IOT_ENDPOINT', iotEndpoint)
            .replace('IOT_POLICY_NAME', ConfigItem.IotPolicyName)
            .replace('SOLUTIONS_SEND_METRICS', ConfigItem.SolutionsSendMetrics)
            .replace('METRICS_ENDPOINT', METRICS_ENDPOINT_PAGE)
            .replace('SOLUTION_ID', ConfigItem.SolutionId)
            .replace('SOLUTION_UUID', ConfigItem.SolutionUuid)
            .replace('SOLUTION_VERION', ConfigItem.SolutionVersion)
            .replace('DEFAULT_LANGUAGE', ConfigItem.DefaultLanguage);

          try {
            response.data = await putObject(S3Bucket, configFile, S3Key);
          } catch (error) {
            console.error(`Copying website asset failed.`);
            throw error;
          }
        }
        break;
      /**
       * DeleteStack will only happen when the stack is deleted or stack resources are replaced.
       * It will detach AWS IoT policy so that the resources can be deleted.
       */
      case 'DeleteStack':
        if (event.RequestType === 'Delete') {
          // Detach AWS IoT policy
          const { IotPolicyName } = properties;
          let message = '';

          // Detach IoT policy
          try {
            message = await detachIotPolicy(IotPolicyName);
          } catch (error) {
            console.error(`Detaching IoT policy failed.`);
            throw error;
          }

          response.data = { Message: message };
        }
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`Error occurred at ${event.RequestType} ${event.ResourceType}:`, error);
    response = {
      status: 'FAILED',
      data: {
        Error: error.message
      }
    }
  } finally {
    await sendResponse(event, context.logStreamName, response);
  }

  return response;
}

/**
 * Sleep for 5 * retry seconds.
 * @param {Number} retry - Retry count
 * @return {Promise} - Sleep promise
 */
async function sleep(retry) {
  const retrySeconds = Number(process.env.RetrySeconds);
  return new Promise(resolve => setTimeout(resolve, retrySeconds * 1000 * retry));
}

/**
 * Get content type by file name.
 * @param {string} filename - File name
 * @return {string} - Content type
 */
function getContentType(filename) {
  let contentType = '';
  if (filename.endsWith('.html')) {
      contentType = 'text/html';
  } else if (filename.endsWith('.css')) {
      contentType = 'text/css';
  } else if (filename.endsWith('.png')) {
      contentType = 'image/png';
  } else if (filename.endsWith('.svg')) {
      contentType = 'image/svg+xml';
  } else if (filename.endsWith('.jpg')) {
      contentType = 'image/jpeg';
  } else if (filename.endsWith('.js')) {
      contentType = 'application/javascript';
  } else {
      contentType = 'binary/octet-stream';
  }
  return contentType;
}

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
    UUID: properties.UUID,
    Version: properties.Version,
    Data: {
      Region: process.env.AWS_REGION,
      Type: properties.Type,
      DefaultLanguage: properties.DefaultLanguage
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
 * Copy website assets from the source bucket to the destination bucket.
 * @param {string} sourceBucket - Source bucket name
 * @param {string} sourceKey - Source object directory
 * @param {string} sourceManifest - Website manifest
 * @param {string} destinationBucket - Destination bucket name
 * @return {Promise} - Promise message object
 */
async function copyWebsite(sourceBucket, sourceKey, sourceManifest, destinationBucket) {
  // In case getting object fails due to asynchronous IAM permission creation, it retries.
  const retryCount = 3;
  let manifest = {};

  // Get manifest file
  for (let retry = 1; retry <= retryCount; retry++) {
    try {
      console.log(`Getting manifest file... Try count: ${retry}`);

      const params = {
        Bucket: sourceBucket,
        Key: `${sourceKey}/${sourceManifest}`
      };
      const response = await s3.getObject(params).promise();
      manifest = JSON.parse(response.Body.toString());

      console.log('Getting manifest file completed.');
      break;
    } catch (error) {
      if (retry === retryCount) {
        console.error('Error occurred while getting manifest file.', error);
        throw error;
      } else {
        console.log('Waiting for retry...');
        await sleep(retry);
      }
    }
  }

  // Copy objects to the destination bucket
  for (let filename of manifest.files) {
    for (let retry = 1; retry <= retryCount; retry++) {
      try {
        console.log(`Copying ${filename}...`);

        const params = {
          Bucket: destinationBucket,
          CopySource: `${sourceBucket}/${sourceKey}/${filename}`,
          Key: filename,
          ContentType: getContentType(filename)
        };
        const response = await s3.copyObject(params).promise();
        console.log(JSON.stringify(response.CopyObjectResult));

        break;
      } catch (error) {
        if (retry === retryCount) {
          console.error('Error occurred while copying website assets.', error);
          throw error;
        } else {
          console.log('Waiting for retry...');
          await sleep(retry);
        }
      }
    }
  }

  return { Message: 'Copying website assets completed.' };
}

/**
 * Put an object into the bucket.
 * @param {string} bucket - Bucket name
 * @param {Buffer|string} filedata - Object body
 * @param {string} filename - Object name
 * @return {Promise} - Promise message object
 */
async function putObject(bucket, filedata, filename) {
  // In case getting object fails due to asynchronous IAM permission creation, it retries.
  const retryCount = 3;
  const params = {
    Bucket: bucket,
    Body: filedata,
    Key: filename,
    ContentType: getContentType(filename)
  };

  for (let retry = 1; retry <= retryCount; retry++) {
    try {
      console.log(`Putting ${filename}... Try count: ${retry}`);

      await s3.putObject(params).promise();

      console.log(`Putting ${filename} completed.`);
      break;
    } catch (error) {
      if (retry === retryCount) {
        console.error(`Error occurred while putting ${filename} into ${bucket} bucket.`, error);
        throw error;
      } else {
        console.log('Waiting for retry...');
        await sleep(retry);
      }
    }
  }

  return {
    Message: `File uploaded: ${filename}.`,
    FileData: filedata
  };
}

/**
 * Get IoT endpoint.
 * @return {Promise} - IoT endpoint
 */
async function getIotEndpoint() {
  const params = {
    endpointType: 'iot:Data-ATS'
  };

  try {
    const response = await iot.describeEndpoint(params).promise();
    return response.endpointAddress;
  } catch (error) {
    console.log('Error getting IoT endpoint.', error);
    throw error;
  }
}

/**
 * Detach IoT policy.
 * @param {string} policyName - IoT policy name
 * @param {string} principal - Pricipal to detach from IoT policy
 * @return {Promise} - Promise message object
 */
async function detachIotPolicy(policyName) {
  try {
    const response = await iot.listTargetsForPolicy({ policyName }).promise();
    const targets = response.targets;

    for (let target of targets) {
      const params = {
        policyName,
        principal: target
      };
      await iot.detachPrincipalPolicy(params).promise();
      console.log(`${target} is detached from ${policyName}.`);
    }

    return 'Detached IoT policy successfully.';
  } catch (error) {
    console.log('Error detaching IoT policy.', error);
    throw error;
  }
}