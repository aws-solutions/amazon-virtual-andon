// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import packages
import { CustomResourceActions, CustomResourceRequestTypes, ICustomResourceRequest } from '../lib/utils';

// Mock axios
const mockAxiosPut = jest.fn();
jest.mock('axios', () => { return { put: mockAxiosPut } });

// Mock UUID
jest.mock('uuid', () => {
  return {
    v4: jest.fn(() => 'mock-uuid')
  };
});

// Mock Metrics client
const mockSendAnonymousMetric = jest.fn();
jest.mock('../../solution-utils/metrics', () => {
  return {
    METRICS_ENDPOINT_PAGE: 'https://mock.metrics.endpoint/page',
    sendAnonymousMetric: mockSendAnonymousMetric
  };
});

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Spy on the console messages
const consoleInfoSpy = jest.spyOn(console, 'info');
const consoleLogSpy = jest.spyOn(console, 'log');
const consoleErrorSpy = jest.spyOn(console, 'error');
const consoleDebugSpy = jest.spyOn(console, 'debug');

// Mock S3
const mockS3GetObject = jest.fn();
const mockS3CopyObject = jest.fn();
const mockS3PutObject = jest.fn();
const mockS3PutBucketCors = jest.fn();
const mockS3GetBucketNotificationConfiguration = jest.fn();
const mockS3PutBucketNotificationConfiguration = jest.fn();
jest.mock('aws-sdk/clients/s3', () => {
  return jest.fn(() => ({
    putBucketNotificationConfiguration: mockS3PutBucketNotificationConfiguration,
    getBucketNotificationConfiguration: mockS3GetBucketNotificationConfiguration,
    getObject: mockS3GetObject,
    copyObject: mockS3CopyObject,
    putBucketCors: mockS3PutBucketCors,
    putObject: mockS3PutObject
  }));
});

// Mock IoT
const mockIotDescribeEndpoint = jest.fn();
const mockIotListTargetForPolicy = jest.fn();
const mockIotDetachPrincipalPolicy = jest.fn();
jest.mock('aws-sdk/clients/iot', () => {
  return jest.fn(() => ({
    describeEndpoint: mockIotDescribeEndpoint,
    listTargetsForPolicy: mockIotListTargetForPolicy,
    detachPrincipalPolicy: mockIotDetachPrincipalPolicy
  }));
});

describe('GENERATE_SOLUTION_CONSTANTS', function () {
  it('should return uuid and iot endpoint for RequestType=Create', async function () {
    mockIotDescribeEndpoint.mockImplementation(() => { return { promise() { return Promise.resolve({ endpointAddress: 'iot.endpoint.com' }); } }; });
    mockAxiosPut.mockResolvedValue({ status: 200 });

    // Import handler
    const index = require('../index');

    const event = {
      "RequestType": "Create",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "ResourceProperties": {
        "Action": "GENERATE_SOLUTION_CONSTANTS",
        "ServiceToken": "LAMBDA_ARN"
      }
    };

    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { AnonymousDataUUID: 'mock-uuid', IotEndpointAddress: 'iot.endpoint.com' }
    });
  });

  it('should pass for RequestType=Delete', async function () {
    mockAxiosPut.mockResolvedValue({ status: 200 });

    // Import handler
    const index = require('../index');
    const event = {
      "RequestType": "Delete",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "ResourceProperties": {
        "Action": "GENERATE_SOLUTION_CONSTANTS",
        "ServiceToken": "LAMBDA_ARN"
      }
    };

    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'No action needed for Delete' }
    });
  });

  it('should return failed when DescribeEndpoint fails', async function () {
    mockIotDescribeEndpoint.mockImplementation(() => { return { promise() { return Promise.reject({ message: 'DescribeEndpoint failed.' }); } }; });

    const event = {
      "RequestType": "Create",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "ResourceProperties": {
        "Action": "GENERATE_SOLUTION_CONSTANTS",
        "ServiceToken": "LAMBDA_ARN"
      }
    };

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'FAILED',
      Data: { Error: 'DescribeEndpoint failed.' }
    });
  });
});

describe('SOLUTION_LIFECYCLE', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // Mock event data
  const event: ICustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    LogicalResourceId: '',
    PhysicalResourceId: '',
    RequestId: '',
    ServiceToken: '',
    StackId: '',
    ResourceType: '',
    ResponseURL: '/cfn-response',
    ResourceProperties: {
      Action: CustomResourceActions.SOLUTION_LIFECYCLE,
      IotPolicyName: 'mock-iot-policy-name',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No'
      }
    }
  };

  it('should send metric when metrics are enabled for Create', async function () {
    mockAxiosPut.mockResolvedValue({ status: 200 });
    const index = require('../index');

    expect.assertions(2);
    const createResult = await index.handler(event, context);

    expect(mockSendAnonymousMetric).toHaveBeenCalledWith({
      SolutionLifecycle: 'Create',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
      }
    });

    expect(createResult).toEqual({ Status: 'SUCCESS', Data: { Message: 'Create completed OK' } });
  });

  it('should send metric when metrics are enabled for Update', async function () {
    mockAxiosPut.mockResolvedValue({ status: 200 });

    // Import handler
    const index = require('../index');
    expect.assertions(2);
    const updateResult = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.UPDATE }, context);

    expect(mockSendAnonymousMetric).toHaveBeenCalledWith({
      SolutionLifecycle: 'Update',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
      }
    });

    expect(updateResult).toEqual({ Status: 'SUCCESS', Data: { Message: 'Update completed OK' } });
  });

  it('should send metric when metrics are enabled for Delete', async function () {
    mockIotListTargetForPolicy.mockImplementationOnce(() => { return { promise() { return Promise.resolve({ targets: ['target-1'] }); } }; });
    mockIotDetachPrincipalPolicy.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    // Import handler
    const index = require('../index');
    expect.assertions(3);
    const deleteResult = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);

    expect(consoleInfoSpy).toHaveBeenCalledWith('[solution-helper-fn-name]', 'target-1 is detached from mock-iot-policy-name');
    expect(deleteResult).toEqual({ Status: 'SUCCESS', Data: { Message: 'Delete completed OK' } });
    expect(mockSendAnonymousMetric).toHaveBeenCalledWith({
      SolutionLifecycle: 'Delete',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
      }
    });
  });

  it('should report a failure if IoT policy actions fail', async function () {
    mockIotListTargetForPolicy.mockImplementationOnce(() => { return { promise() { return Promise.reject(new Error('fail message')); } }; });

    // Import handler
    const index = require('../index');
    expect.assertions(3);
    const deleteResult = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);

    expect(consoleErrorSpy).toHaveBeenCalledWith('[solution-helper-fn-name]', 'Error detaching IoT policy.', new Error('fail message'));
    expect(deleteResult).toEqual({ Status: 'FAILED', Data: { Error: 'fail message' } });
    expect(mockSendAnonymousMetric).toHaveBeenCalledWith({
      SolutionLifecycle: 'Delete',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
      }
    });
  });

  it('should not attempt to send a metric when metrics are turned off', async function () {
    process.env.SEND_ANONYMOUS_DATA = 'No';
    mockAxiosPut.mockResolvedValueOnce({ status: 200 });

    // Import handler
    const index = require('../index');

    expect.assertions(2);
    const createResult = await index.handler(event, context);

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();

    expect(createResult).toEqual({ Status: 'SUCCESS', Data: { Message: 'Create completed OK' } });
  });
});

describe('COPY_WEBSITE', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // Mock event data
  const event: ICustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    LogicalResourceId: '',
    PhysicalResourceId: '',
    RequestId: '',
    ServiceToken: '',
    StackId: '',
    ResourceType: '',
    ResponseURL: '/cfn-response',
    ResourceProperties: {
      Action: CustomResourceActions.COPY_WEBSITE,
      IotPolicyName: 'mock-iot-policy-name',
      SolutionParameters: {
        DefaultLanguage: 'mock-default-language',
        LoggingLevel: 'VERBOSE',
        StartGlueWorkflow: 'No',
        AnomalyDetectionBucketParameterSet: 'No',
        CognitoSAMLProviderNameParameterSet: 'No',
        CognitoDomainPrefixParameterSet: 'No',
        CognitoSAMLProviderMetadataUrlParameterSet: 'No'
      }
    }
  };

  it('should return success to copy website for create', async function () {
    mockS3GetObject.mockImplementationOnce(() => { return { promise() { return Promise.resolve({ Body: '{ "files": ["index.html", "logo.png", "image.svg", "image.jpg", "javascript.js", "style.css", "object.json" ] }' }); } }; });
    mockS3CopyObject.mockImplementation(() => { return { promise() { return Promise.resolve({ CopyObjectResult: 'Success' }); } }; });
    mockS3PutBucketCors.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'Copying website assets completed.' }
    });
  });

  it('should pass through for delete', async function () {
    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: {}
    });
  });

  it('should return failed when GetObject fails', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementation(() => { return { promise() { return Promise.reject({ message: 'GetObject failed.' }); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'FAILED',
      Data: { Error: 'GetObject failed.' }
    });
  });

  it('should return failed when CopyObject fails', async function () {
    // Mock AWS SDK
    mockS3GetObject.mockImplementation(() => { return { promise() { return Promise.resolve({ Body: '{ "files": [ "index.html", "logo.png" ] }' }); } }; });
    mockS3CopyObject.mockImplementation(() => { return { promise() { return Promise.reject({ message: 'CopyObject failed.' }); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'FAILED',
      Data: { Error: 'CopyObject failed.' }
    });
  });
});

describe('PUT_WEBSITE_CONFIG', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // Mock event data
  const event: ICustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    LogicalResourceId: '',
    PhysicalResourceId: '',
    RequestId: '',
    ServiceToken: '',
    StackId: '',
    ResourceType: '',
    ResponseURL: '/cfn-response',
    ResourceProperties: {
      Action: CustomResourceActions.PUT_WEBSITE_CONFIG,
      S3Bucket: 's3-bucket',
      AndonWebsiteConfigFileBaseName: 'config-base-name',
      AndonWebsiteConfig: {
        aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
        aws_appsync_graphqlEndpoint: 'gql-endpoint',
        aws_appsync_region: process.env.AWS_REGION,
        aws_cognito_identity_pool_id: 'identity-pool-id',
        aws_cognito_region: process.env.AWS_REGION,
        aws_iot_endpoint: 'iot-endpoint',
        aws_iot_policy_name: 'iot-policy-name',
        aws_project_region: process.env.AWS_REGION,
        aws_user_pools_id: 'user-pool-id',
        aws_user_pools_web_client_id: 'user-pool-client-id',
        default_language: 'default-lang',
        solutions_metrics_endpoint: 'https://metrics.awssolutionsbuilder.com/page',
        solutions_send_metrics: process.env.SEND_ANONYMOUS_DATA,
        solutions_solutionId: 'solution-id',
        solutions_solutionUuId: 'solution-uuid',
        solutions_version: 'solution-version',
        website_bucket: 'website-bucket'
      }
    }
  };

  it('should return success to put website config for create', async function () {
    mockIotDescribeEndpoint.mockImplementation(() => { return { promise() { return Promise.resolve({ endpointAddress: 'iot.endpoint.com' }); } }; });
    mockS3PutObject.mockImplementation(() => { return { promise() { return Promise.resolve(); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);

    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: {
        Message: 'File uploaded: assets/config-base-name.js.',
        FileData: `const config-base-name = ${JSON.stringify({
          aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
          aws_appsync_graphqlEndpoint: 'gql-endpoint',
          aws_appsync_region: 'mock-region-1',
          aws_cognito_identity_pool_id: 'identity-pool-id',
          aws_cognito_region: 'mock-region-1',
          aws_iot_endpoint: 'iot-endpoint',
          aws_iot_policy_name: 'iot-policy-name',
          aws_project_region: 'mock-region-1',
          aws_user_pools_id: 'user-pool-id',
          aws_user_pools_web_client_id: 'user-pool-client-id',
          default_language: 'default-lang',
          solutions_metrics_endpoint: 'https://metrics.awssolutionsbuilder.com/page',
          solutions_send_metrics: 'Yes',
          solutions_solutionId: 'solution-id',
          solutions_solutionUuId: 'solution-uuid',
          solutions_version: 'solution-version',
          website_bucket: 'website-bucket',
        }, null, 2)};`
      }
    });
  });

  it('should pass through for delete', async function () {
    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: {}
    });
  });

  it('should return failed when PutObject fails', async function () {
    mockIotDescribeEndpoint.mockImplementation(() => { return { promise() { return Promise.resolve({ endpointAddress: 'iot.endpoint.com' }); } }; });
    mockS3PutObject.mockImplementation(() => { return { promise() { return Promise.reject({ message: 'PutObject failed.' }); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'FAILED',
      Data: { Error: 'PutObject failed.' }
    });
  });
});

describe('CONFIGURE_BUCKET_NOTIFICATION', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // Mock event data
  const event: ICustomResourceRequest = {
    RequestType: CustomResourceRequestTypes.CREATE,
    LogicalResourceId: '',
    PhysicalResourceId: '',
    RequestId: '',
    ServiceToken: '',
    StackId: '',
    ResourceType: '',
    ResponseURL: '/cfn-response',
    ResourceProperties: {
      Action: CustomResourceActions.CONFIGURE_BUCKET_NOTIFICATION,
      BucketName: 'anomalies-bucket-name',
      FunctionArn: 'arn:of:function'
    }
  };

  it('should return success to configure bucket notification for create', async function () {
    // Mock AWS SDK
    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });
    mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect.assertions(2);
    expect(mockS3PutBucketNotificationConfiguration).toHaveBeenCalledWith({
      Bucket: 'anomalies-bucket-name',
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [{
          Events: ['s3:ObjectCreated:*'],
          LambdaFunctionArn: 'arn:of:function'
        }]
      }
    });
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'Bucket Notification Configuration Put Successfully' }
    });
  });

  it('should remove any previous bucket notification configuration on delete', async function () {
    expect.assertions(2);

    mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });
    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({
            LambdaFunctionConfigurations: [{
              LambdaFunctionArn: 'arn:of:function',
              Events: ['s3:ObjectCreated:*']
            }]
          });
        }
      };
    });

    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);

    expect(consoleInfoSpy).toHaveBeenCalledWith('[solution-helper-fn-name]', 'Putting Bucket Notification Configuration', JSON.stringify({
      Bucket: 'anomalies-bucket-name',
      NotificationConfiguration: {
        LambdaFunctionConfigurations: []
      }
    }, null, 2));

    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'Bucket Notification Configuration Put Successfully' }
    });
  });

  it('should not update a configuration if no LambdaFunctionConfigurations were returned', async function () {
    expect.assertions(2);

    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);

    expect(mockS3PutBucketNotificationConfiguration).not.toHaveBeenCalled();

    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'No update to Bucket Notification Configuration needed' }
    });
  });

  it('should not update a configuration if no prior config for the given FunctionArn exists', async function () {
    expect.assertions(2);

    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({
            LambdaFunctionConfigurations: [{
              LambdaFunctionArn: 'arn:of:different:function',
              Events: ['s3:ObjectCreated:*']
            }]
          });
        }
      };
    });

    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: CustomResourceRequestTypes.DELETE }, context);

    expect(mockS3PutBucketNotificationConfiguration).not.toHaveBeenCalled();

    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'No update to Bucket Notification Configuration needed' }
    });
  });

  it('should pass through for an unexpected request type', async function () {
    expect.assertions(4);

    const index = require('../index');
    const result = await index.handler({ ...event, RequestType: 'unexpected' }, context);

    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleDebugSpy).toHaveBeenCalledTimes(0);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: {}
    });
  });

  it('should return failed when configure bucket notification fails', async function () {
    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.reject({ message: 'Failed to put bucket notification' }); } }; });
    mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.reject({ message: 'Failed to put bucket notification' }); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'FAILED',
      Data: { Error: 'Failed to put bucket notification' }
    });
  });

  it('should add to the bucket configuration if one already exists for another function', async function () {
    // Mock AWS SDK
    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({
            LambdaFunctionConfigurations: [
              { Events: ['foo:Action*'], LambdaFunctionArn: 'arn:of:foo:function' }
            ]
          });
        }
      };
    });

    mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect.assertions(2);
    expect(mockS3PutBucketNotificationConfiguration).toHaveBeenCalledWith({
      Bucket: 'anomalies-bucket-name',
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          { Events: ['foo:Action*'], LambdaFunctionArn: 'arn:of:foo:function' },
          { Events: ['s3:ObjectCreated:*'], LambdaFunctionArn: 'arn:of:function' }
        ]
      }
    });
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'Bucket Notification Configuration Put Successfully' }
    });
  });

  it('should add to the event list a configuration already exists for the same function function', async function () {
    // Mock AWS SDK
    mockS3GetBucketNotificationConfiguration.mockImplementationOnce(() => {
      return {
        promise() {
          return Promise.resolve({
            LambdaFunctionConfigurations: [
              { Events: ['foo:Action*'], LambdaFunctionArn: 'arn:of:function' }
            ]
          });
        }
      };
    });

    mockS3PutBucketNotificationConfiguration.mockImplementationOnce(() => { return { promise() { return Promise.resolve({}); } }; });

    const index = require('../index');
    const result = await index.handler(event, context);
    expect.assertions(2);
    expect(mockS3PutBucketNotificationConfiguration).toHaveBeenCalledWith({
      Bucket: 'anomalies-bucket-name',
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          { Events: ['foo:Action*', 's3:ObjectCreated:*'], LambdaFunctionArn: 'arn:of:function' }
        ]
      }
    });
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: { Message: 'Bucket Notification Configuration Put Successfully' }
    });
  });
});

describe('Default', function () {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    jest.resetModules();
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

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
    const index = require('../index');
    const result = await index.handler(event, context);
    expect(result).toEqual({
      Status: 'SUCCESS',
      Data: {}
    });
  });
});
