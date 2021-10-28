// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Construct, Stack, StackProps, CfnParameter, CfnMapping, Aws, CfnOutput, CfnCondition, Fn, Tags, Aspects } from '@aws-cdk/core';
import { FrontEnd } from './front-end/front-end-construct';
import { CommonResources } from './common-resources/common-resources-construct';
import { BackEnd } from './back-end/back-end-construct';
import { CustomResourceActions } from '../../solution-helper/lib/utils';
import { ISetupPutWebsiteConfigCustomResourceProps, LambdaFunctionAspect } from '../utils/utils';

export interface AmazonVirtualAndonStackProps extends StackProps {
  readonly description: string;
  readonly solutionId: string;
  readonly solutionName: string;
  readonly solutionVersion: string;
  readonly solutionDisplayName: string;
  readonly solutionAssetHostingBucketNamePrefix: string;
}

export class AmazonVirtualAndonStack extends Stack {
  constructor(scope: Construct, id: string, props: AmazonVirtualAndonStackProps) {
    super(scope, id, props);

    const administratorEmail = new CfnParameter(this, 'AdministratorEmail', {
      description: '(Required) Email address for Amazon Virtual Andon administrator.',
      allowedPattern: '^[_A-Za-z0-9-\\+]+(\\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\\.[A-Za-z0-9]+)*(\\.[A-Za-z]{2,})$',
      constraintDescription: 'Default User Email must be a valid email address'
    });

    const defaultLanguage = new CfnParameter(this, 'DefaultLanguage', {
      description: 'Amazon Virtual Andon web interface default language. Choose "Browser Default" if you want to use your browser language as a default language.',
      allowedValues: [
        'Browser Default',
        'Chinese (Simplified)',
        'English',
        'French (France)',
        'German',
        'Japanese',
        'Korean',
        'Spanish (Spain)',
        'Thai'
      ],
      default: 'Browser Default'
    });

    const loggingLevel = new CfnParameter(this, 'LoggingLevel', {
      type: 'String',
      description: 'The logging level of the Lambda functions and the UI',
      allowedValues: [
        'VERBOSE',
        'DEBUG',
        'INFO',
        'WARN',
        'ERROR'
      ],
      default: 'ERROR'
    });

    const solutionMapping = new CfnMapping(this, 'Solution', {
      mapping: {
        Config: {
          AnonymousUsage: 'Yes',
          SolutionId: props.solutionId,
          Version: props.solutionVersion,
          S3BucketPrefix: props.solutionAssetHostingBucketNamePrefix,
          S3KeyPrefix: `${props.solutionName}/${props.solutionVersion}`
        }
      }
    });

    const sourceCodeBucketName = `${solutionMapping.findInMap('Config', 'S3BucketPrefix')}-${Aws.REGION}`;

    const commonResources = new CommonResources(this, 'CommonResources', {
      defaultLanguage: defaultLanguage.valueAsString,
      sendAnonymousData: solutionMapping.findInMap('Config', 'AnonymousUsage'),
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionDisplayName: props.solutionDisplayName,
      sourceCodeBucketName,
      sourceCodeKeyPrefix: solutionMapping.findInMap('Config', 'S3KeyPrefix'),
      loggingLevel: loggingLevel.valueAsString
    });

    const frontEnd = new FrontEnd(this, 'FrontEnd', {
      anonymousDataUUID: commonResources.solutionHelper.anonymousDataUUID,
      administratorEmail: administratorEmail.valueAsString,
      logsBucket: commonResources.logsBucket,
      sendAnonymousData: solutionMapping.findInMap('Config', 'AnonymousUsage'),
      solutionDisplayName: props.solutionDisplayName,
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      sourceCodeBucketName,
      sourceCodeKeyPrefix: solutionMapping.findInMap('Config', 'S3KeyPrefix'),
      loggingLevel: loggingLevel.valueAsString
    });

    const backEnd = new BackEnd(this, 'BackEnd', {
      solutionId: props.solutionId,
      solutionVersion: props.solutionVersion,
      solutionDisplayName: props.solutionDisplayName,
      sourceCodeBucketName,
      sourceCodeKeyPrefix: solutionMapping.findInMap('Config', 'S3KeyPrefix'),
      userPool: frontEnd.userPool,
      logsBucket: commonResources.logsBucket,
      loggingLevel: loggingLevel.valueAsString,
      solutionHelperLambda: commonResources.solutionHelper.solutionHelperLambda,
      iotEndpointAddress: commonResources.solutionHelper.iotEndpointAddress
    });

    commonResources.solutionHelper.setupCopyWebsiteCustomResource({
      hostingBucket: frontEnd.websiteHostingBucket,
      hostingDomain: frontEnd.websiteDistribution.domainName
    });

    const putWebsiteConfigCustomResourceProps: ISetupPutWebsiteConfigCustomResourceProps = {
      hostingBucket: frontEnd.websiteHostingBucket,
      andonWebsiteConfigFileName: 'andon_config',
      customResourceAction: CustomResourceActions.PUT_WEBSITE_CONFIG,
      andonWebsiteConfig: {
        aws_project_region: Aws.REGION,
        aws_cognito_region: Aws.REGION,
        aws_appsync_region: Aws.REGION,
        aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS',
        aws_cognito_identity_pool_id: frontEnd.identityPool.ref,
        aws_user_pools_id: frontEnd.userPool.userPoolId,
        aws_user_pools_web_client_id: frontEnd.userPoolClient.userPoolClientId,
        aws_appsync_graphqlEndpoint: backEnd.appsyncApi.graphqlApi.graphqlUrl,
        aws_iot_endpoint: `wss://${commonResources.solutionHelper.iotEndpointAddress}`,
        aws_iot_policy_name: backEnd.iotResourcePolicy.ref,
        default_language: defaultLanguage.valueAsString,
        solutions_metrics_endpoint: 'https://metrics.awssolutionsbuilder.com/page',
        solutions_send_metrics: solutionMapping.findInMap('Config', 'AnonymousUsage'),
        solutions_solutionId: props.solutionId,
        solutions_version: props.solutionVersion,
        solutions_solutionUuId: commonResources.solutionHelper.anonymousDataUUID,
        website_bucket: frontEnd.websiteHostingBucket.bucketName,
      }
    };

    const putWebsiteConfigCustomResource = commonResources.solutionHelper.setupPutWebsiteConfigCustomResource(putWebsiteConfigCustomResourceProps);

    frontEnd.setupPutWebsiteWithOAuthConfigCustomResource(putWebsiteConfigCustomResource, commonResources.solutionHelper.solutionHelperLambda.functionArn, putWebsiteConfigCustomResourceProps);

    commonResources.solutionHelper.setupSolutionLifecycleCustomResource({
      iotPolicyName: backEnd.iotResourcePolicy.ref,
      defaultLanguage: defaultLanguage.valueAsString,
      loggingLevel: loggingLevel.valueAsString,
      startGlueWorkflow: backEnd.dataAnalysisConstruct.startGlueWorkflow.valueAsString as 'Yes' | 'No',
      anomalyDetectionBucketParameterSet: this.returnParameterSetFlag('anomalyDetectionBucketParameterSet', backEnd.externalIntegrationsConstruct.anomalyDetectionBucketParameter),
      cognitoDomainPrefixParameterSet: this.returnParameterSetFlag('cognitoDomainPrefixParameterSet', frontEnd.cognitoDomainPrefixParameter),
      cognitoSAMLProviderMetadataUrlParameterSet: this.returnParameterSetFlag('cognitoSAMLProviderMetadataUrlParameterSet', frontEnd.samlProviderMetadataUrlParameter),
      cognitoSAMLProviderNameParameterSet: this.returnParameterSetFlag('cognitoSAMLProviderNameParameterSet', frontEnd.samlProviderNameParameter)
    });

    this.templateOptions.metadata = {
      'AWS::CloudFormation::Interface': {
        ParameterGroups: [
          {
            Label: { default: 'Dashboard Configuration' },
            Parameters: [administratorEmail.logicalId, defaultLanguage.logicalId]
          },
          {
            Label: { default: 'General Configuration' },
            Parameters: [loggingLevel.logicalId, backEnd.dataAnalysisConstruct.startGlueWorkflow.logicalId]
          },
          {
            Label: { default: 'Lookout for Equipment Integration (Optional)' },
            Parameters: [backEnd.externalIntegrationsConstruct.anomalyDetectionBucketParameter.logicalId]
          },
          {
            Label: { default: 'SAML Identity Provider Configuration (Optional)' },
            Parameters: [
              frontEnd.cognitoDomainPrefixParameter.logicalId,
              frontEnd.samlProviderNameParameter.logicalId,
              frontEnd.samlProviderMetadataUrlParameter.logicalId
            ]
          }
        ],
        ParameterLabels: {
          [loggingLevel.logicalId]: { default: 'Log Level' },
          [backEnd.dataAnalysisConstruct.startGlueWorkflow.logicalId]: { default: 'Activate AWS Glue Workflow' },
          [administratorEmail.logicalId]: { default: 'Administrator Email' },
          [defaultLanguage.logicalId]: { default: 'UI Default Language' },
          [backEnd.externalIntegrationsConstruct.anomalyDetectionBucketParameter.logicalId]: { default: 'Anomaly Detection Output Bucket' },
          [frontEnd.cognitoDomainPrefixParameter.logicalId]: { default: 'Cognito Domain Prefix' },
          [frontEnd.samlProviderNameParameter.logicalId]: { default: 'SAML Provider Name' },
          [frontEnd.samlProviderMetadataUrlParameter.logicalId]: { default: 'SAML Provider Metadata Url' }
        }
      }
    };

    new CfnOutput(this, 'AmazonVirtualAndonConsole', { description: `${props.solutionDisplayName} console URL`, value: `https://${frontEnd.websiteDistribution.domainName}` }); // NOSONAR: typescript:S1848
    new CfnOutput(this, 'WebsiteAssetBucket', { description: 'Amazon Virtual Andon web site assets bucket', value: frontEnd.websiteHostingBucket.bucketName }); // NOSONAR: typescript:S1848
    new CfnOutput(this, 'GraphQLEndpoint', { description: 'Amazon Virtual Andon GraphQL endpoint', value: backEnd.appsyncApi.graphqlApi.graphqlUrl });  // NOSONAR: typescript:S1848
    new CfnOutput(this, 'SolutionVersion', { description: 'SolutionVersion', value: props.solutionVersion }); // NOSONAR: typescript:S1848

    Tags.of(this).add('SolutionId', props.solutionId);
    Aspects.of(this).add(new LambdaFunctionAspect());
  }

  private returnParameterSetFlag(parameterType: string, parameter: CfnParameter): 'Yes' | 'No' {
    const condition = new CfnCondition(this, `${parameterType}Condition`, {
      expression: Fn.conditionEquals(parameter.valueAsString, '')
    });

    return (Fn.conditionIf(condition.logicalId, 'No', 'Yes') as unknown) as 'Yes' | 'No';
  }
}
