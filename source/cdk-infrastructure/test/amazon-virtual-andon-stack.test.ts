// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { expect as expectCDK, matchTemplate, MatchStyle, SynthUtils } from '@aws-cdk/assert';
import '@aws-cdk/assert/jest';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import * as cdk from '@aws-cdk/core';
import * as CdkInfrastructure from '../lib/amazon-virtual-andon-stack';
import { addCfnSuppressRules } from '../utils/utils';

test('AVA Test Stack Snapshot', () => {
  const app = new cdk.App();

  const stack = new CdkInfrastructure.AmazonVirtualAndonStack(app, 'TestStack', {
    description: 'AVA Test Stack',
    solutionAssetHostingBucketNamePrefix: 'hosting-bucket',
    solutionDisplayName: 'AVA Test',
    solutionId: 'SOxyz',
    solutionName: 'ava-test',
    solutionVersion: 'v3.0.0'
  });

  expect.assertions(1);
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
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

  expect.assertions(2);
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
  expect(stack).toHaveResource('AWS::DynamoDB::Table');
});
