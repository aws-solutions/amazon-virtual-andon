// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, CfnParameter, CfnCondition, Stack, Duration, ArnFormat, Aws, Fn, CfnResource, CustomResource } from '@aws-cdk/core';
import { Function as LambdaFunction, CfnPermission as LambdaPermission, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Bucket } from '@aws-cdk/aws-s3';
import { Table } from '@aws-cdk/aws-dynamodb';
import { Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal, Effect } from '@aws-cdk/aws-iam';
import { IotConstants } from '../../../utils/utils';
import { CustomResourceActions, IConfigureBucketNotificationRequestProps } from '../../../../solution-helper/lib/utils';
import { IotToLambda } from '@aws-solutions-constructs/aws-iot-lambda';

export interface ExternalIntegrationsProps {
  readonly solutionDisplayName: string;
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly sourceCodeBucketName: string;
  readonly sourceCodeKeyPrefix: string;
  readonly loggingLevel: string;
  readonly issuesTable: Table;
  readonly dataHierarchyTable: Table;
  readonly solutionHelperLambda: LambdaFunction;
  readonly iotEndpointAddress: string;
}

/**
 * Construct that creates resources for the External Integrations for this solution
 */
export class ExternalIntegrations extends Construct {
  public readonly anomalyDetectionBucketParameter: CfnParameter;

  constructor(scope: Construct, id: string, props: ExternalIntegrationsProps) {
    super(scope, id);

    const sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);

    this.anomalyDetectionBucketParameter = new CfnParameter(this, 'AnomalyDetectionBucketParameter', {
      description: '(Optional) The name of the Amazon S3 bucket which will contain anomaly detection files',
      default: '',
      maxLength: 63,
      allowedPattern: '^[a-z0-9.-]*$'
    });
    this.anomalyDetectionBucketParameter.overrideLogicalId('AnomalyDetectionBucketParameter');

    const anomalyDetectionBucketCondition = new CfnCondition(this, 'AnomalyDetectionBucketCondition', {
      expression: Fn.conditionNot(Fn.conditionEquals(this.anomalyDetectionBucketParameter.valueAsString, ''))
    });

    const anomalyDetectionBucket = Bucket.fromBucketName(this, 'anomalyDetectionBucket', this.anomalyDetectionBucketParameter.valueAsString);

    const externalIntegrationsFnRole = new Role(this, 'ExternalIntegrationsLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      path: '/',
      inlinePolicies: {
        'DynamoDbPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:GetItem'],
              resources: [props.dataHierarchyTable.tableArn]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [`${props.dataHierarchyTable.tableArn}/index/ByTypeAndParent-index`]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [`${props.issuesTable.tableArn}/index/ByDeviceEvent-index`]
            })
          ]
        }),
        'CloudWatchLogsPolicy': new PolicyDocument({
          statements: [new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: [Stack.of(this).formatArn({ service: 'logs', resource: 'log-group', resourceName: '/aws/lambda/*', arnFormat: ArnFormat.COLON_RESOURCE_NAME })]
          })]
        }),
        'IotPolicy': new PolicyDocument({
          statements: [new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['iot:Publish'],
            resources: [Stack.of(this).formatArn({ service: 'iot', resource: 'topic', resourceName: IotConstants.ISSUES_TOPIC, arnFormat: ArnFormat.SLASH_RESOURCE_NAME })]
          })]
        })
      }
    });

    (new Policy(this, 'AnomalyDetectionBucketPolicy', {
      document: new PolicyDocument({
        statements: [new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [anomalyDetectionBucket.arnForObjects('*')]
        })]
      }),
      roles: [externalIntegrationsFnRole]
    }).node.defaultChild as CfnResource).cfnOptions.condition = anomalyDetectionBucketCondition;

    const externalIntegrationsIotToLambda = new IotToLambda(this, 'ExternalIntegrationsIotToLambda', {
      iotTopicRuleProps: {
        topicRulePayload: {
          description: 'Messages from devices are sent to this topic for processing',
          sql: `SELECT * FROM '${IotConstants.DEVICES_TOPIC}'`,
          actions: []
        }
      },
      lambdaFunctionProps: {
        runtime: Runtime.NODEJS_14_X,
        handler: 'external-integrations-handler/index.handler',
        timeout: Duration.seconds(60),
        description: `${props.solutionDisplayName} (${props.solutionVersion}): Handles issues created by external integrations`,
        code: Code.fromBucket(sourceCodeBucket, [props.sourceCodeKeyPrefix, 'external-integrations-handler.zip'].join('/')),
        role: externalIntegrationsFnRole,
        environment: {
          LOGGING_LEVEL: props.loggingLevel,
          DATA_HIERARCHY_TABLE: props.dataHierarchyTable.tableName,
          ISSUES_TABLE: props.issuesTable.tableName,
          IOT_ENDPOINT_ADDRESS: props.iotEndpointAddress,
          SOLUTION_ID: props.solutionId,
          SOLUTION_VERSION: props.solutionVersion,
          ISSUES_TOPIC: IotConstants.ISSUES_TOPIC,
          IOT_MESSAGE_NAME_DELIMITER: '/'
        }
      }
    });

    new LambdaPermission(this, 'ExternalIntegrationsLambdaPermission', {
      action: 'lambda:InvokeFunction',
      principal: 's3.amazonaws.com',
      sourceArn: anomalyDetectionBucket.bucketArn,
      sourceAccount: Aws.ACCOUNT_ID,
      functionName: externalIntegrationsIotToLambda.lambdaFunction.functionName
    }).cfnOptions.condition = anomalyDetectionBucketCondition;

    const solutionHelperPutBucketNotificationPolicy = new Policy(this, 'SolutionHelperPutBucketNotificationPolicy', {
      document: new PolicyDocument({
        statements: [new PolicyStatement({
          actions: ['s3:GetBucketNotification', 's3:PutBucketNotification'],
          effect: Effect.ALLOW,
          resources: [anomalyDetectionBucket.bucketArn]
        })]
      }),
      roles: [props.solutionHelperLambda.role!]
    });
    (solutionHelperPutBucketNotificationPolicy.node.defaultChild as CfnResource).cfnOptions.condition = anomalyDetectionBucketCondition;

    const configureDetectedAnomaliesBucketNotificationCustomResourceProps: IConfigureBucketNotificationRequestProps = {
      Action: CustomResourceActions.CONFIGURE_BUCKET_NOTIFICATION,
      BucketName: anomalyDetectionBucket.bucketName,
      FunctionArn: externalIntegrationsIotToLambda.lambdaFunction.functionArn
    };

    const configureBucketNotificationCustomResource = new CustomResource(this, 'ConfigureBucketNotificationCustomResource', {
      serviceToken: props.solutionHelperLambda.functionArn,
      properties: configureDetectedAnomaliesBucketNotificationCustomResourceProps
    });

    (configureBucketNotificationCustomResource.node.defaultChild as CfnResource).addDependsOn(solutionHelperPutBucketNotificationPolicy.node.defaultChild as CfnResource);
    (configureBucketNotificationCustomResource.node.defaultChild as CfnResource).addDependsOn(externalIntegrationsIotToLambda.lambdaFunction.node.defaultChild as CfnResource);
    (configureBucketNotificationCustomResource.node.defaultChild as CfnResource).cfnOptions.condition = anomalyDetectionBucketCondition;
  }
}
