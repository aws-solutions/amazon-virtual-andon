// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { getOptions } from '../solution-utils/get-options';
import Logger, { LoggingLevel as LogLevel } from '../solution-utils/logger';
import { ICustomResourceRequest, ILambdaContext, CustomResourceActions, ICompletionStatus, StatusTypes, ICopyWebsiteRequestProps, IPutWebsiteConfigRequestProps, IConfigureBucketNotificationRequestProps, ISolutionLifecycleRequestProps, CustomResourceRequestTypes } from './lib/utils';
import { handleGenerateSolutionConstants } from './generate-solution-constants';
import { sendAnonymousMetric } from '../solution-utils/metrics';

// Import AWS SDK
import S3 from 'aws-sdk/clients/s3';
import Iot from 'aws-sdk/clients/iot';
const awsSdkOptions = getOptions();
const s3 = new S3(awsSdkOptions);
const iot = new Iot(awsSdkOptions);

const { RETRY_SECONDS, SEND_ANONYMOUS_DATA, LOGGING_LEVEL, AWS_LAMBDA_FUNCTION_NAME } = process.env;
const logger = new Logger(AWS_LAMBDA_FUNCTION_NAME, LOGGING_LEVEL);

/**
 * Request handler.
 */
export async function handler(event: ICustomResourceRequest, context: ILambdaContext) {
  logger.log(LogLevel.INFO, `Received event: ${JSON.stringify(event)}`);

  let response: ICompletionStatus = {
    Status: StatusTypes.Success,
    Data: {}
  };

  try {
    switch (event.ResourceProperties.Action) {
      case CustomResourceActions.GENERATE_SOLUTION_CONSTANTS:
        const handlerOutput = await handleGenerateSolutionConstants(event);

        if (!handlerOutput.anonymousUUID) {
          response.Data.Message = `No action needed for ${event.RequestType}`;
        } else {
          response.Data.AnonymousDataUUID = handlerOutput.anonymousUUID;
          response.Data.IotEndpointAddress = handlerOutput.iotEndpointAddress;
        }

        break;
      case CustomResourceActions.SOLUTION_LIFECYCLE:
        if (SEND_ANONYMOUS_DATA === 'Yes') {
          await sendAnonymousMetric({
            SolutionLifecycle: event.RequestType,
            SolutionParameters: (event.ResourceProperties as ISolutionLifecycleRequestProps).SolutionParameters
          });
        }

        if (event.RequestType === 'Delete') {
          // Detach AWS IoT policy so that the resources can be deleted.
          const { IotPolicyName } = (event.ResourceProperties as ISolutionLifecycleRequestProps);

          try {
            await detachIotPolicy(IotPolicyName);
          } catch (error) {
            logger.log(LogLevel.ERROR, `Detaching IoT policy failed.`);
            throw error;
          }
        }

        response.Data = { Message: `${event.RequestType} completed OK` };
        break;
      case CustomResourceActions.COPY_WEBSITE:
        if ([CustomResourceRequestTypes.CREATE, CustomResourceRequestTypes.UPDATE].includes(event.RequestType)) {
          const { SourceBucket, SourceKey, SourceManifest, DestinationBucket, WebsiteDistributionDomain } = (event.ResourceProperties as ICopyWebsiteRequestProps);

          try {
            response.Data = await copyWebsite(SourceBucket, SourceKey, SourceManifest, DestinationBucket, WebsiteDistributionDomain);
          } catch (error) {
            logger.log(LogLevel.ERROR, 'Copying website asset failed.');
            throw error;
          }
        }
        break;
      case CustomResourceActions.PUT_WEBSITE_CONFIG:
        if ([CustomResourceRequestTypes.CREATE, CustomResourceRequestTypes.UPDATE].includes(event.RequestType)) {
          const { S3Bucket, AndonWebsiteConfigFileBaseName, AndonWebsiteConfig } = (event.ResourceProperties as IPutWebsiteConfigRequestProps);
          const configFile = `const ${AndonWebsiteConfigFileBaseName} = ${JSON.stringify(AndonWebsiteConfig, null, 2)};`;

          try {
            logger.log(LogLevel.VERBOSE, 'Putting website config file', configFile);
            response.Data = await putObject(S3Bucket, configFile, `assets/${AndonWebsiteConfigFileBaseName}.js`);
          } catch (error) {
            logger.log(LogLevel.ERROR, 'Put website config failed.');
            throw error;
          }
        }
        break;
      case CustomResourceActions.CONFIGURE_BUCKET_NOTIFICATION:
        try {
          if (![CustomResourceRequestTypes.CREATE, CustomResourceRequestTypes.UPDATE, CustomResourceRequestTypes.DELETE].includes(event.RequestType)) {
            break;
          }

          let shouldPutBucketNotificationConfig = false;

          const { BucketName, FunctionArn } = (event.ResourceProperties as IConfigureBucketNotificationRequestProps);
          const getBucketNotificationConfigParams: S3.GetBucketNotificationConfigurationRequest = {
            Bucket: BucketName
          };

          logger.log(LogLevel.INFO, 'Getting bucket notification configuration');
          logger.log(LogLevel.VERBOSE, 'Get bucket notification configuration parameters', JSON.stringify(getBucketNotificationConfigParams, null, 2));

          const bucketNotificationConfig = await s3.getBucketNotificationConfiguration(getBucketNotificationConfigParams).promise();
          logger.log(LogLevel.VERBOSE, 'Get bucket notification configuration response', JSON.stringify(bucketNotificationConfig, null, 2));

          // Check to see if there is already a configuration for this function
          let idx = -1;
          if (bucketNotificationConfig.LambdaFunctionConfigurations) {
            idx = bucketNotificationConfig.LambdaFunctionConfigurations.findIndex((c: any) => c.LambdaFunctionArn === FunctionArn);
          }

          if ([CustomResourceRequestTypes.CREATE, CustomResourceRequestTypes.UPDATE].includes(event.RequestType)) {
            // Add the s3:ObjectCreated:* notification configuration to the bucket so it will call
            // the external integrations handler Lambda function

            const requiredS3Event = 's3:ObjectCreated:*';
            const lambdaFnConfig: S3.LambdaFunctionConfiguration = {
              Events: [requiredS3Event],
              LambdaFunctionArn: FunctionArn
            };

            if (!bucketNotificationConfig.LambdaFunctionConfigurations) {
              bucketNotificationConfig.LambdaFunctionConfigurations = [lambdaFnConfig];
            } else {
              if (idx > -1) {
                // Make sure the required event is included. Use a Set to ensure a unique list
                bucketNotificationConfig.LambdaFunctionConfigurations[idx].Events = Array.from(new Set<string>([...bucketNotificationConfig.LambdaFunctionConfigurations[idx].Events, requiredS3Event]));
              } else {
                bucketNotificationConfig.LambdaFunctionConfigurations.push(lambdaFnConfig);
              }
            }

            shouldPutBucketNotificationConfig = true;
          } else {
            // Remove the bucket configuration for the external integration handler

            if (idx > -1) {
              bucketNotificationConfig.LambdaFunctionConfigurations.splice(idx, 1);
              shouldPutBucketNotificationConfig = true;
            }
          }

          const bucketNotificationConfigParams: S3.PutBucketNotificationConfigurationRequest = {
            Bucket: BucketName,
            NotificationConfiguration: bucketNotificationConfig
          };

          if (shouldPutBucketNotificationConfig) {
            logger.log(LogLevel.INFO, 'Putting Bucket Notification Configuration', JSON.stringify(bucketNotificationConfigParams, null, 2));
            await s3.putBucketNotificationConfiguration(bucketNotificationConfigParams).promise();
            response.Data = { Message: 'Bucket Notification Configuration Put Successfully' };
          } else {
            response.Data = { Message: 'No update to Bucket Notification Configuration needed' };
          }
        } catch (err) {
          logger.log(LogLevel.ERROR, 'Error while putting bucket notification configuration');
          throw err;
        }

        break;
      default:
        break;
    }
  } catch (error) {
    logger.log(LogLevel.ERROR, `Error occurred at ${event.RequestType} ${event.ResourceType}:`, error);
    response = {
      Status: StatusTypes.Failed,
      Data: {
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
async function sleep(retry: number): Promise<void> {
  const retrySeconds = Number(RETRY_SECONDS);
  return new Promise(resolve => setTimeout(resolve, retrySeconds * 1000 * retry));
}

/**
 * Get content type by file name.
 * @param {string} filename - File name
 * @return {string} - Content type
 */
function getContentType(filename: string): string {
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
async function sendResponse(event: ICustomResourceRequest, logStreamName: string, response: ICompletionStatus): Promise<AxiosResponse> {
  const responseBody = JSON.stringify({
    Status: response.Status,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
    PhysicalResourceId: event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: response.Data,
  });

  const config: AxiosRequestConfig = {
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  };

  return axios.put(event.ResponseURL, responseBody, config);
}

/**
 * Copy website assets from the source bucket to the destination bucket.
 * @param {string} sourceBucket - Source bucket name
 * @param {string} sourceKey - Source object directory
 * @param {string} sourceManifest - Website manifest
 * @param {string} destinationBucket - Destination bucket name
 * @param {string} websiteDistributionDomain - CloudFront Distribution Domain for the Web Console
 * @return {Promise<{Message: string}>} - Promise message object
 */
async function copyWebsite(sourceBucket: string, sourceKey: string, sourceManifest: string, destinationBucket: string, websiteDistributionDomain: string): Promise<{ Message: string; }> {
  // In case getting object fails due to asynchronous IAM permission creation, it retries.
  const retryCount = 3;
  let manifest: any;

  // Get manifest file
  for (let retry = 1; retry <= retryCount; retry++) {
    try {
      logger.log(LogLevel.INFO, `Getting manifest file... Try count: ${retry}`);

      const params = {
        Bucket: sourceBucket,
        Key: `${sourceKey}/${sourceManifest}`
      };
      const response = await s3.getObject(params).promise();
      manifest = JSON.parse(response.Body.toString());

      logger.log(LogLevel.INFO, 'Getting manifest file completed.');
      break;
    } catch (error) {
      await getManifestFileError(retry, retryCount, error);
    }
  }

  // Copy objects to the destination bucket
  for (let filename of manifest.files) {
    for (let retry = 1; retry <= retryCount; retry++) {
      try {
        logger.log(LogLevel.INFO, `Copying ${filename}...`);

        const params = {
          Bucket: destinationBucket,
          CopySource: `${sourceBucket}/${sourceKey}/${filename}`,
          Key: filename,
          ContentType: getContentType(filename)
        };
        const response = await s3.copyObject(params).promise();
        logger.log(LogLevel.INFO, JSON.stringify(response.CopyObjectResult));

        break;
      } catch (error) {
        await copyObjectsError(retry, retryCount, error);
      }
    }
  }

  // Configure CORS for the destination (website) bucket
  const putCorsParams = {
    Bucket: destinationBucket,
    CORSConfiguration: {
      CORSRules: [{
        AllowedMethods: ['GET', 'POST', 'PUT'],
        AllowedOrigins: [websiteDistributionDomain],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag']
      }]
    }
  };

  logger.log(LogLevel.INFO, 'Putting Bucket CORS', JSON.stringify(putCorsParams, null, 2));
  await s3.putBucketCors(putCorsParams).promise();

  return { Message: 'Copying website assets completed.' };
}

async function copyObjectsError(retry: number, retryCount: number, error: any) {
  if (retry === retryCount) {
    logger.log(LogLevel.ERROR, 'Error occurred while copying website assets.', error);
    throw error;
  } else {
    logger.log(LogLevel.INFO, 'Waiting for retry...');
    await sleep(retry);
  }
}

async function getManifestFileError(retry: number, retryCount: number, error: any) {
  if (retry === retryCount) {
    logger.log(LogLevel.ERROR, 'Error occurred while getting manifest file.', error);
    throw error;
  } else {
    logger.log(LogLevel.INFO, 'Waiting for retry...');
    await sleep(retry);
  }
}

/**
 * Put an object into the bucket.
 * @param {string} bucket - Bucket name
 * @param {Buffer|string} filedata - Object body
 * @param {string} filename - Object name
 * @return {Promise<{Message: string}>} - Promise message object
 */
async function putObject(bucket: string, filedata: string | Buffer, filename: string): Promise<{ Message: string; FileData: Buffer | string; }> {
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
      logger.log(LogLevel.INFO, `Putting ${filename}... Try count: ${retry}`);

      await s3.putObject(params).promise();

      logger.log(LogLevel.INFO, `Putting ${filename} completed.`);
      break;
    } catch (error) {
      if (retry === retryCount) {
        logger.log(LogLevel.ERROR, `Error occurred while putting ${filename} into ${bucket} bucket.`, error);
        throw error;
      } else {
        logger.log(LogLevel.INFO, 'Waiting for retry...');
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
 * Detach IoT policy.
 * @param {string} policyName - IoT policy name
 * @return {Promise} - Promise message object
 */
async function detachIotPolicy(policyName: string): Promise<void> {
  try {
    const response = await iot.listTargetsForPolicy({ policyName }).promise();
    const targets = response.targets;

    for (let target of targets) {
      const params: Iot.DetachPrincipalPolicyRequest = {
        policyName,
        principal: target
      };
      await iot.detachPrincipalPolicy(params).promise();
      console.log(`${target} is detached from ${policyName}`);
      logger.log(LogLevel.INFO, `${target} is detached from ${policyName}`);
    }
  } catch (error) {
    logger.log(LogLevel.ERROR, 'Error detaching IoT policy.', error);
    throw error;
  }
}
