// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

process.env.LOGGING_LEVEL = 'VERBOSE';
process.env.AWS_LAMBDA_FUNCTION_NAME = 'appsync-lambda-resolver-fn-name';
process.env.DATA_HIERARCHY_TABLE_NAME = 'data-table';
process.env.ISSUES_TABLE_NAME = 'issues-table';
process.env.ISSUE_NOTIFICATION_TOPIC_ARN = 'arn:of:topic';
