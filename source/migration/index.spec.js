/*********************************************************************************************************************
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
const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');
const axiosMock = new MockAdapter(axios);

// System environment
process.env.AWS_REGION = 'mock-region-1';
process.env.RetrySeconds = 0.01;

// Mock axios
axiosMock.onPut('/cfn-response').reply(200);

// Mock context
const context = {
  logStreamName: 'log-stream'
};

// Mock AWS SDK
const mockSnsPublish = jest.fn();
const mockDynamoDBDescribeTable = jest.fn();
const mockDynamoDBScan = jest.fn();
const mockDynmoDBBatchWrite = jest.fn();
jest.mock('aws-sdk', () => {
  return {
    DynamoDB: jest.fn(() => ({
      describeTable: mockDynamoDBDescribeTable
    })),
    SNS: jest.fn(() => ({
      publish: mockSnsPublish
    }))
  };
});
jest.mock('aws-sdk/clients/dynamodb', () => {
  return {
    DocumentClient: jest.fn(() => ({
      scan: mockDynamoDBScan,
      batchWrite: mockDynmoDBBatchWrite
    }))
  };
});

// Import index.js
const index = require('./index.js');

// Unit tests
describe('index', function() {
  describe('SendAnonymousUsage', function() {
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
        "Version": "test-version"
      }
    };

    it('should return success when sending anonymous usage succeeds', async function() {
      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(200);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent successfully.' }
      });
    });
    it('should return success when sending anonymous usage fails', async function() {
      // Mock axios
      axiosMock.onPost('https://metrics.awssolutionsbuilder.com/generic').reply(500);

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Anonymous data was sent failed.' }
      });
    });
  });

  describe('MigrateData', function() {
    // Mock event data
    const event = {
      "RequestType": "Create",
      "ServiceToken": "LAMBDA_ARN",
      "ResponseURL": "/cfn-response",
      "StackId": "CFN_STACK_ID",
      "RequestId": "02f6b8db-835e-4a83-b338-520f642e8f97",
      "LogicalResourceId": "TableMigration",
      "ResourceType": "Custom::TableMigration",
      "ResourceProperties": {
        "ServiceToken": "LAMBDA_ARN",
        "SourceTable": "source-table",
        "DestinationTable": "destination-table"
      }
    };

    beforeEach(() => {
      mockDynamoDBDescribeTable.mockReset();
      mockDynamoDBScan.mockReset();
      mockDynmoDBBatchWrite.mockReset();
      mockSnsPublish.mockReset();
    });

    it('should return success to migrate table', async function() {
      // Mock AWS SDK
      mockDynamoDBDescribeTable.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:DescribeTable
            return Promise.resolve({
              Table: {}
            });
          }
        };
      });
      mockDynamoDBScan.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:Scan
            return Promise.resolve({
              Items: [{ migration: 'item' }],
              ScannedCount: 1
            });
          }
        };
      });
      mockDynmoDBBatchWrite.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:BatchWriteItem
            return Promise.resolve({ UnprocessedItems: {} });
          }
        };
      });
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: '1 item(s) migrated.' }
      });
    });
    it('should return success to migrate table with last evaluated key', async function() {
      // Mock AWS SDK
      mockDynamoDBDescribeTable.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:DescribeTable
            return Promise.resolve({
              Table: {}
            });
          }
        };
      });
      mockDynamoDBScan.mockImplementationOnce(() => {
        return {
          promise() {
            // dynamodb:Scan
            return Promise.resolve({
              Items: [
                { migration: 'item1' }, { migration: 'item2' }, { migration: 'item3' },
                { migration: 'item4' }, { migration: 'item5' }, { migration: 'item6' },
                { migration: 'item7' }, { migration: 'item8' }, { migration: 'item9' },
                { migration: 'item10' }, { migration: 'item11' }, { migration: 'item12' },
                { migration: 'item13' }, { migration: 'item14' }, { migration: 'item15' },
                { migration: 'item16' }, { migration: 'item17' }, { migration: 'item18' },
                { migration: 'item19' }, { migration: 'item20' }, { migration: 'item21' },
                { migration: 'item22' }, { migration: 'item23' }, { migration: 'item24' },
                { migration: 'item25' }, { migration: 'item26' }
              ],
              ScannedCount: 26,
              LastEvaluatedKey: { migration: 'item26' }
            });
          }
        };
      }).mockImplementationOnce(() => {
        return {
          promise() {
            // dynamodb:Scan
            return Promise.resolve({
              Items: [{ migration: 'item26' }],
              ScannedCount: 1
            });
          }
        };
      });
      mockDynmoDBBatchWrite.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:BatchWriteItem
            return Promise.resolve({ UnprocessedItems: {} });
          }
        };
      });
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: '26 item(s) migrated.' }
      });
    });
    it('should return failed when table name is not provided', async function() {
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      event.ResourceProperties.SourceTable = '';
      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Please provide table names correctly.' }
      });
    });
    it('should return failed when table name is not provided and Publish fails', async function() {
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.reject();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Please provide table names correctly.' }
      });
    });
    it('should return failed when DescribeTable fails', async function() {
      // Mock AWS SDK
      mockDynamoDBDescribeTable.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:DescribeTable
            return Promise.reject({
              message: 'Requested resource not found: Table: not found',
              code: 'ResourceNotFoundException'
            });
          }
        };
      });
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      event.ResourceProperties.SourceTable = 'source-table';
      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'An error occurred while describing tables. Please check the table names.' }
      });
    });
    it('should return failed when Scan fails', async function() {
      // Mock AWS SDK
      mockDynamoDBDescribeTable.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:DescribeTable
            return Promise.resolve({
              Table: {}
            });
          }
        };
      });
      mockDynamoDBScan.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:Scan
            return Promise.reject({ message: 'Scan failed.' });
          }
        };
      });
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'Scan failed.' }
      });
    });
    it('should return failed when BatchWriteItem fails', async function() {
      // Mock AWS SDK
      mockDynamoDBDescribeTable.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:DescribeTable
            return Promise.resolve({
              Table: {}
            });
          }
        };
      });
      mockDynamoDBScan.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:Scan
            return Promise.resolve({
              Items: [{ migration: 'item' }],
              ScannedCount: 1
            });
          }
        };
      });
      mockDynmoDBBatchWrite.mockImplementation(() => {
        return {
          promise() {
            // dynamodb:BatchWriteItem
            return Promise.reject({ message: 'BatchWriteItem failed.' });
          }
        };
      });
      mockSnsPublish.mockImplementation(() => {
        return {
          promise() {
            // sns:Publish
            return Promise.resolve();
          }
        };
      });

      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: { Message: 'BatchWriteItem failed.' }
      });
    });
  });

  describe('Default', function() {
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

    it('should return success for other default custom resource', async function() {
      const result = await index.handler(event, context);
      expect(result).toEqual({
        status: 'SUCCESS',
        data: {
          Message: ""
        }
      });
    });
  });
});
