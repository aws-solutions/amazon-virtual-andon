// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const axiosMock = new MockAdapter(axios);

// System environment
process.env.AWS_REGION = 'mock-region-1';
process.env.RetrySeconds = 0.01;

// Mock UUID
jest.mock('uuid', () => {
  return {
    v4: jest.fn(() => 'mock-uuid')
  };
});

// Mock axios
axiosMock.onPut('/cfn-response').reply(200);

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Mock AWS SDK
const mockS3GetObject = jest.fn();
const mockS3CopyObject = jest.fn();
const mockS3PutObject = jest.fn();
const mockS3PutBucketCors = jest.fn();
const mockS3PutBucketNotificationConfiguration = jest.fn();
const mockIotDescribeEndpoint = jest.fn();
const mockIotListTargetForPolicy = jest.fn();
const mockIotDetachPrincipalPolicy = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(() => ({
      getObject: mockS3GetObject,
      copyObject: mockS3CopyObject,
      putObject: mockS3PutObject,
      putBucketCors: mockS3PutBucketCors,
      putBucketNotificationConfiguration: mockS3PutBucketNotificationConfiguration
    })),
    Iot: jest.fn(() => ({
      describeEndpoint: mockIotDescribeEndpoint,
      listTargetsForPolicy: mockIotListTargetForPolicy,
      detachPrincipalPolicy: mockIotDetachPrincipalPolicy
    }))
  };
});

const WEB_CONFIG = `const andon_config = {
  "aws_project_region": "mock-region-1",
  "aws_cognito_identity_pool_id": "IDENTITY_POOL_ID",
  "aws_cognito_region": "mock-region-1",
  "aws_user_pools_id": "USER_POOL_ID",
  "aws_user_pools_web_client_id": "USER_POOL_CLIENT_ID",
  "oauth": {},
  "aws_appsync_graphqlEndpoint": "https://graphql.com/graphql",
  "aws_appsync_region": "mock-region-1",
  "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
  "aws_iot_endpoint": "wss://iot.endpoint.com",
  "aws_iot_policy_name": "iot-resource-policy",
  "solutions_send_metrics": "Yes",
  "solutions_metrics_endpoint": "https://metrics.awssolutionsbuilder.com/page",
  "solutions_solutionId": "SOLUTION_ID",
  "solutions_solutionUuId": "mock-uuid",
  "solutions_version": "test-version",
  "default_language": "English",
  "website_bucket": "website-bucket"
};`;

// Import index.js
const index = require('./index.js');

// Unit tests
describe('index', function () {
  describe('CreateUuid', function () {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "CreateUuid",
      "ResourceType": "Custom::CreateUuid",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN"
      }
    };

    it('should return uuid', async function () {
      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { UUID: 'mock-uuid' }
      });
    });
  });

  describe('SendAnonymousUsage', function () {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "SendAnonymousUsage",
      "ResourceType": "Custom::SendAnonymousUsage",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "SolutionId": "SOLUTION_ID",
        "UUID": "mock-uuid",
        "Version": "test-version",
        "DefaultLanguage": "English"
      }
    };

    it('should return success when sending anonymous usage succeeds', async function () {
      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(200);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent successfully.' }
      });
    });
    it('should return success when sending anonymous usage fails', async function () {
      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(500);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent failed.' }
      });
    });
  });

  describe('CopyWebsite', function () {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "CopyWebsite",
      "ResourceType": "Custom::CopyWebsite",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "SourceBucket": "source-bucket",
        "SourceKey": "amazon-virtual-andon/consolemock-uuid",
        "SourceManifest": "site-manifest.json",
        "DestinationBucket": "destination-bucket",
        "WebsiteDistributionDomain": "https://domain.name"
      }
    };

    beforeEach(() => {
      mockS3GetObject.mockReset();
      mockS3CopyObject.mockReset();
      mockS3PutBucketCors.mockReset();
    });

    it('should return success to copy website', async function () {
      // Mock AWS SDK
      mockS3GetObject.mockImplementation(() => {
        return {
          promise() {
            // s3:GetObject
            return Promise.resolve({
              Body: '{ "files": ["index.html", "logo.png", "image.svg", "image.jpg", "javascript.js", "style.css", "object.json" ] }'
            });
          }
        };
      });
      mockS3CopyObject.mockImplementation(() => {
        return {
          promise() {
            // s3:CopyObject
            return Promise.resolve({ CopyObjectResult: 'Success' });
          }
        };
      });
      mockS3PutBucketCors.mockImplementationOnce(() => {
        return {
          promise() {
            // s3:CopyObject
            return Promise.resolve({});
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Copying website assets completed.' }
      });
    });

    it('should return failed when GetObject fails', async function () {
      // Mock AWS SDK
      mockS3GetObject.mockImplementation(() => {
        return {
          promise() {
            // s3:GetObject
            return Promise.reject({ message: 'GetObject failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'GetObject failed.' }
      });
    });

    it('should return failed when CopyObject fails', async function () {
      // Mock AWS SDK
      mockS3GetObject.mockImplementation(() => {
        return {
          promise() {
            // s3:GetObject
            return Promise.resolve({
              Body: '{ "files": [ "index.html", "logo.png" ] }'
            });
          }
        };
      });
      mockS3CopyObject.mockImplementation(() => {
        return {
          promise() {
            // s3:CopyObject
            return Promise.reject({ message: 'CopyObject failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'CopyObject failed.' }
      });
    });
  });

  describe('PutWebsiteConfig', function () {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "PutWebsiteConfig",
      "ResourceType": "Custom::PutWebsiteConfig",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "S3Bucket": "destination-bucket",
        "S3Key": "assets/andon_config.js",
        "ConfigItem": {
          "UserPoolId": "USER_POOL_ID",
          "UserPoolClientWebId": "USER_POOL_CLIENT_ID",
          "CognitoIdentityPoolId": "IDENTITY_POOL_ID",
          "GraphQLEndpoint": "https://graphql.com/graphql",
          "IotPolicyName": "iot-resource-policy",
          "SolutionsSendMetrics": "Yes",
          "SolutionId": "SOLUTION_ID",
          "SolutionUuid": "mock-uuid",
          "SolutionVersion": "test-version",
          "DefaultLanguage": "English",
          "WebsiteBucket": "website-bucket"
        }
      }
    };

    beforeEach(() => {
      mockS3PutObject.mockReset();
      mockIotDescribeEndpoint.mockReset();
    });

    it('should return success to put website config', async function () {
      // Mock AWS SDK
      mockIotDescribeEndpoint.mockImplementation(() => {
        return {
          promise() {
            // iot:DescribeEndpoint
            return Promise.resolve({ endpointAddress: 'iot.endpoint.com' });
          }
        };
      });
      mockS3PutObject.mockImplementation(() => {
        return {
          promise() {
            // s3:PutObject
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: {
          Message: 'File uploaded: assets/andon_config.js.',
          FileData: WEB_CONFIG
        }
      });
    });

    it('should return failed when DescribeEndpoint fails', async function () {
      // Mock AWS SDK
      mockIotDescribeEndpoint.mockImplementation(() => {
        return {
          promise() {
            // iot:DescribeEndpoint
            return Promise.reject({ message: 'DescribeEndpoint failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'DescribeEndpoint failed.' }
      });
    });

    it('should return failed when PutObject fails', async function () {
      // Mock AWS SDK
      mockIotDescribeEndpoint.mockImplementation(() => {
        return {
          promise() {
            // iot:DescribeEndpoint
            return Promise.resolve({ endpointAddress: 'iot.endpoint.com' });
          }
        };
      });
      mockS3PutObject.mockImplementation(() => {
        return {
          promise() {
            // s3:PutObject
            return Promise.reject({ message: 'PutObject failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'PutObject failed.' }
      });
    });
  });

  describe('DeleteStack', function () {
    // Mock event data
    const event = {
      "RequestType": "Delete",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "DeleteStack",
      "ResourceType": "Custom::DeleteStack",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "IotPolicyName": "iot-resource-policy"
      }
    };

    beforeEach(() => {
      mockIotListTargetForPolicy.mockReset();
      mockIotDetachPrincipalPolicy.mockReset();
    });

    it('should return success to detach IoT policy', async function () {
      // Mock AWS SDK
      mockIotListTargetForPolicy.mockImplementation(() => {
        return {
          promise() {
            // iot:ListTargetsForPolicy
            return Promise.resolve({
              targets: [
                'arn:target1',
                'arn:target2'
              ]
            });
          }
        };
      });
      mockIotDetachPrincipalPolicy.mockImplementation(() => {
        return {
          promise() {
            // iot:DetachPrincipalPolicy
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Detached IoT policy successfully.' }
      });
    });

    it('should return failed when ListTargetForPolicy fails', async function () {
      // Mock AWS SDK
      mockIotListTargetForPolicy.mockImplementation(() => {
        return {
          promise() {
            // iot:ListTargetsForPolicy
            return Promise.reject({ message: 'ListTargetForPolicy failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'ListTargetForPolicy failed.' }
      });
    });

    it('should return failed when DetachPrincipalPolicy fails', async function () {
      // Mock AWS SDK
      mockIotListTargetForPolicy.mockImplementation(() => {
        return {
          promise() {
            // iot:ListTargetsForPolicy
            return Promise.resolve({
              targets: [
                'arn:target1',
                'arn:target2'
              ]
            });
          }
        };
      });
      mockIotDetachPrincipalPolicy.mockImplementation(() => {
        return {
          promise() {
            // iot:DetachPrincipalPolicy
            return Promise.reject({ message: 'DetachPrincipalPolicy failed.' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'DetachPrincipalPolicy failed.' }
      });
    });
  });

  describe('ConfigureDetectedAnomaliesBucketNotification', function () {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "ConfigureDetectedAnomaliesBucketNotification",
      "ResourceType": "Custom::ConfigureDetectedAnomaliesBucketNotification",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "DetectedAnomaliesBucketName": "bucket-name",
        "HandleIssuesFunctionArn": "arn:of:function"
      }
    };

    beforeEach(() => {
      mockS3PutBucketNotificationConfiguration.mockReset();
    });

    it('should return success to configure bucket notification', async function () {
      // Mock AWS SDK
      mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => {
        return {
          promise() {
            return Promise.resolve({});
          }
        };
      });

      const result = await index.handler(event, context);
      expect.assertions(2);
      expect(mockS3PutBucketNotificationConfiguration).toHaveBeenCalledWith({
        Bucket: 'bucket-name',
        NotificationConfiguration: {
          LambdaFunctionConfigurations: [{
            Events: ['s3:ObjectCreated:*'],
            LambdaFunctionArn: 'arn:of:function'
          }]
        }
      });
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Bucket Notification Configuration Put Successfully' }
      });
    });

    it('should return failed when configure bucket notification fails', async function () {
      // Mock AWS SDK
      mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => {
        return {
          promise() {
            return Promise.reject({ message: 'Failed to put bucket notification' });
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'FAILED',
        data: { Error: 'Failed to put bucket notification' }
      });
    });
  });

  describe('Default', function () {
    // Mock event data
    const event = {
      "RequestType": "Update",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "Default",
      "ResourceType": "Custom::Default",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN"
      }
    };

    it('should return success for other default custom resource', async function () {
      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: {}
      });
    });
  });
});
