// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Template } from 'aws-cdk-lib/assertions';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';
import { addCfnSuppressRules } from '../utils/utils';
import * as CdkInfrastructure from '../lib/amazon-virtual-andon-stack';

let stack: cdk.Stack;

describe('CDK Infra Tests', () => {

  beforeAll(() => {
    const app = new cdk.App();
    stack = new CdkInfrastructure.AmazonVirtualAndonStack(app, 'TestStack', {
      description: 'AVA Test Stack',
      solutionAssetHostingBucketNamePrefix: 'hosting-bucket',
      solutionDisplayName: 'AVA Test',
      solutionId: 'SOxyz',
      solutionName: 'ava-test',
      solutionVersion: 'v3.0.2',
    });
  });

  test('CDK Template Infra Resource Test', () => {
    Template.fromStack(stack).resourceCountIs('AWS::ServiceCatalogAppRegistry::Application', 1);

    Template.fromStack(stack).resourceCountIs('AWS::Cognito::UserPoolClient', 1);

    Template.fromStack(stack).resourceCountIs('AWS::IAM::Policy', 14);

    Template.fromStack(stack).resourceCountIs('AWS::IAM::Role', 16);

    Template.fromStack(stack).resourceCountIs('AWS::IoT::Policy', 1);

    Template.fromStack(stack).resourceCountIs('AWS::Glue::Table', 2);

    Template.fromStack(stack).resourceCountIs('AWS::Lambda::Function', 6);

    Template.fromStack(stack).resourceCountIs('AWS::S3::Bucket', 4);

    Template.fromStack(stack).resourceCountIs('AWS::DynamoDB::Table', 2);

    Template.fromStack(stack).resourceCountIs('AWS::SNS::Topic', 1);

    Template.fromStack(stack).resourceCountIs('AWS::AppSync::GraphQLApi', 1);
  });


});

test('utils', () => {
  const stack = new cdk.Stack();

  const testTable1 = new cdk.CfnResource(stack, 'TestTable1', {
    type: 'AWS::DynamoDB::Table'
  });

  const testTable2 = new Table(stack, 'TestTable2', {
    partitionKey: { name: 'name', type: AttributeType.STRING }
  });

  addCfnSuppressRules(testTable1, [{ id: 'abc', reason: 'mock reason' }]);
  addCfnSuppressRules(testTable1, [{ id: 'xyz', reason: 'mock reason' }]);
  addCfnSuppressRules(testTable2, [{ id: 'xyz', reason: 'mock reason' }]);

  expect.assertions(1);
  expect(Object.keys(Template.fromStack(stack).findResources('AWS::DynamoDB::Table')).length).toBeGreaterThan(0);
});
