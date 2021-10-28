// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, Duration, Aws, CfnResource, Stack, ArnFormat } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { Runtime, Code, Function as LambdaFunction } from '@aws-cdk/aws-lambda';
import { AppSyncApi } from './appsync-api/appsync-api-construct';
import { UserPool } from '@aws-cdk/aws-cognito';
import { Effect, PolicyStatement, ServicePrincipal, Role, PolicyDocument } from '@aws-cdk/aws-iam';
import { IotToLambda } from '@aws-solutions-constructs/aws-iot-lambda';
import { Topic } from '@aws-cdk/aws-sns';
import { Alias } from '@aws-cdk/aws-kms'
import { DataAnalysis } from './data-analysis/data-analysis-construct';
import { ExternalIntegrations } from './external-integrations/external-integrations-construct';
import { IotConstants } from '../../utils/utils';

export interface BackEndProps {
    readonly userPool: UserPool;
    readonly sourceCodeBucketName: string;
    readonly sourceCodeKeyPrefix: string;
    readonly solutionVersion: string;
    readonly solutionDisplayName: string;
    readonly solutionId: string;
    readonly loggingLevel: string;
    readonly logsBucket: Bucket;
    readonly solutionHelperLambda: LambdaFunction;
    readonly iotEndpointAddress: string;
}

/**
 * Construct that creates back-end resources for this solution. 
 * AppSync API (and related resources), Issue Notification Topic, and the Issue Handler Lambda function are created
 */
export class BackEnd extends Construct {
    public readonly appsyncApi: AppSyncApi;
    public readonly iotToLambda: IotToLambda;
    public readonly iotResourcePolicy: CfnResource;
    public readonly issueNotificationTopic: Topic;
    public readonly dataAnalysisConstruct: DataAnalysis;
    public readonly externalIntegrationsConstruct: ExternalIntegrations;

    constructor(scope: Construct, id: string, props: BackEndProps) {
        super(scope, id);

        const sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);

        this.issueNotificationTopic = new Topic(this, 'IssueNotificationTopic', {
            displayName: 'Amazon Virtual Andon Notifications',
            masterKey: Alias.fromAliasName(this, 'AwsManagedSnsKey', 'alias/aws/sns')
        });
        (this.issueNotificationTopic.node.defaultChild as CfnResource).overrideLogicalId('IssueNotificationTopic');

        this.appsyncApi = new AppSyncApi(this, 'AppSyncApi', {
            userPool: props.userPool,
            solutionDisplayName: props.solutionDisplayName,
            solutionVersion: props.solutionVersion,
            sourceCodeBucketName: props.sourceCodeBucketName,
            sourceCodeKeyPrefix: props.sourceCodeKeyPrefix,
            loggingLevel: props.loggingLevel,
            issueNotificationTopicArn: this.issueNotificationTopic.topicArn
        });

        const handleIssuesFunctionRole = new Role(this, 'HandleIssuesFunctionRole', {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            path: '/',
            inlinePolicies: {
                'GraphQLPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['appsync:GraphQL'],
                        resources: [
                            `${this.appsyncApi.graphqlApi.arn}/types/Mutation/fields/createIssue`,
                            `${this.appsyncApi.graphqlApi.arn}/types/Mutation/fields/updateIssue`
                        ]
                    })]
                }),
                'SnsPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['sns:Publish'],
                        resources: [this.issueNotificationTopic.topicArn]
                    })]
                }),
                'DynamoDbPolicy': new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['dynamodb:GetItem'],
                            resources: [this.appsyncApi.dataHierarchyTable.tableArn]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['dynamodb:Query'],
                            resources: [`${this.appsyncApi.issuesTable.tableArn}/index/ByDeviceEvent-index`]
                        })
                    ]
                }),
                'CloudWatchLogsPolicy': new PolicyDocument({
                    statements: [new PolicyStatement({
                        effect: Effect.ALLOW,
                        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                        resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '/aws/lambda/*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
                    })]
                })
            }
        });

        this.iotToLambda = new IotToLambda(this, 'IotToLambda', {
            iotTopicRuleProps: {
                topicRulePayload: {
                    description: 'Issues from the AVA Client are submitted to this topic and sent to lambda for processing',
                    sql: `SELECT * FROM '${IotConstants.ISSUES_TOPIC}'`,
                    actions: []
                }
            },
            lambdaFunctionProps: {
                runtime: Runtime.NODEJS_14_X,
                handler: 'ava-issue-handler/index.handler',
                timeout: Duration.seconds(60),
                description: `${props.solutionDisplayName} (${props.solutionVersion}): Handles issues posted to the '${IotConstants.ISSUES_TOPIC}' IoT Topic`,
                code: Code.fromBucket(sourceCodeBucket, [props.sourceCodeKeyPrefix, 'ava-issue-handler.zip'].join('/')),
                role: handleIssuesFunctionRole,
                environment: {
                    API_ENDPOINT: this.appsyncApi.graphqlApi.graphqlUrl,
                    ACCOUNT_ID: Aws.ACCOUNT_ID,
                    ISSUES_TABLE: this.appsyncApi.issuesTable.tableName,
                    DATA_HIERARCHY_TABLE: this.appsyncApi.dataHierarchyTable.tableName,
                    ISSUE_NOTIFICATION_TOPIC_ARN: this.issueNotificationTopic.topicArn,
                    LOGGING_LEVEL: props.loggingLevel,
                    SOLUTION_ID: props.solutionId,
                    SOLUTION_VERSION: props.solutionVersion
                }
            }
        });

        this.iotResourcePolicy = new CfnResource(this, 'IoTResourcePolicy', {
            type: 'AWS::IoT::Policy',
            properties: {
                PolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: Effect.ALLOW,
                            Action: ['iot:Publish'],
                            Resource: [
                                Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: IotConstants.ISSUES_TOPIC, arnFormat: ArnFormat.SLASH_RESOURCE_NAME }),
                                Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })
                            ]
                        },
                        {
                            Effect: Effect.ALLOW,
                            Action: ['iot:Subscribe'],
                            Resource: [Stack.of(this).formatArn({ service: 'iot', resource: 'topicfilter', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
                        },
                        {
                            Effect: Effect.ALLOW,
                            Action: ['iot:Receive'],
                            Resource: [Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: `${IotConstants.GROUPS_TOPIC}/*`, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
                        },
                        {
                            Effect: Effect.ALLOW,
                            Action: ['iot:Connect'],
                            Resource: [Stack.of(this).formatArn({ service: 'iot', resource: 'client', resourceName: '*', arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
                        }
                    ]
                }
            }
        });

        this.dataAnalysisConstruct = new DataAnalysis(this, 'DataAnalysis', {
            solutionDisplayName: props.solutionDisplayName,
            solutionId: props.solutionId,
            solutionVersion: props.solutionVersion,
            sourceCodeBucketName: props.sourceCodeBucketName,
            sourceCodeKeyPrefix: props.sourceCodeKeyPrefix,
            loggingLevel: props.loggingLevel,
            issuesTable: this.appsyncApi.issuesTable,
            dataHierarchyTable: this.appsyncApi.dataHierarchyTable,
            logsBucket: props.logsBucket
        });

        this.externalIntegrationsConstruct = new ExternalIntegrations(this, 'ExternalIntegrations', {
            solutionDisplayName: props.solutionDisplayName,
            solutionId: props.solutionId,
            solutionVersion: props.solutionVersion,
            sourceCodeBucketName: props.sourceCodeBucketName,
            sourceCodeKeyPrefix: props.sourceCodeKeyPrefix,
            loggingLevel: props.loggingLevel,
            dataHierarchyTable: this.appsyncApi.dataHierarchyTable,
            issuesTable: this.appsyncApi.issuesTable,
            solutionHelperLambda: props.solutionHelperLambda,
            iotEndpointAddress: props.iotEndpointAddress
        });
    }
}
