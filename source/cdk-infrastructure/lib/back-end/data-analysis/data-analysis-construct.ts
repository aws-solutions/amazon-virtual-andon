// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, RemovalPolicy, CfnResource, CfnParameter, CfnCondition, Fn } from "aws-cdk-lib";
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket, IBucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { CfnCrawler as GlueCrawler, CfnJob as GlueJob, CfnTable as GlueTable, CfnWorkflow as GlueWorkflow, CfnTrigger as GlueTrigger } from 'aws-cdk-lib/aws-glue';
import { PolicyDocument, PolicyStatement, Role, ServicePrincipal, Effect, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { addCfnSuppressRules } from '../../../utils/utils';
import { Construct } from "constructs";
import { Database } from "@aws-cdk/aws-glue-alpha";
import { NagSuppressions } from "cdk-nag";

export interface DataAnalysisProps {
  readonly solutionDisplayName: string;
  readonly solutionId: string;
  readonly solutionVersion: string;
  readonly sourceCodeBucketName: string;
  readonly sourceCodeKeyPrefix: string;
  readonly loggingLevel: string;
  readonly issuesTable: Table;
  readonly dataHierarchyTable: Table;
}

/**
 * Construct that creates resources for the Data Analysis component of the solution
 */
export class DataAnalysis extends Construct {
  private readonly glueOutputObjectPrefix = 'glue/ddb-output';
  private readonly solutionId: string;
  private readonly solutionVersion: string;
  private readonly sourceCodeBucket: IBucket;
  private readonly sourceCodeKeyPrefix: string;
  private readonly ddbIssuesTable: Table;
  private readonly ddbDataHierarchyTable: Table;
  private readonly glueOutputBucket: Bucket;
  private readonly glueDatabaseName: string;
  private readonly glueIssuesTableName: string;
  private readonly glueDataHierarchyTableName: string;
  private readonly glueWorkflowCondition: CfnCondition;
  public readonly startGlueWorkflow: CfnParameter;

  constructor(scope: Construct, id: string, props: DataAnalysisProps) {
    super(scope, id);

    this.solutionId = props.solutionId;
    this.solutionVersion = props.solutionVersion;
    this.sourceCodeBucket = Bucket.fromBucketName(this, 'sourceCodeBucket', props.sourceCodeBucketName);
    this.sourceCodeKeyPrefix = props.sourceCodeKeyPrefix;
    this.ddbIssuesTable = props.issuesTable;
    this.ddbDataHierarchyTable = props.dataHierarchyTable;

    this.startGlueWorkflow = new CfnParameter(this, 'StartGlueWorkflow', {
      type: 'String',
      description: 'Do you want to perform the Glue Workflow that will extract Amazon Virtual Andon\'s DynamoDB data to S3 for analysis with Athena? If set to \'Yes\', the process will run every Monday at 1am UTC by default',
      allowedValues: ['Yes', 'No'],
      default: 'No'
    });
    this.startGlueWorkflow.overrideLogicalId('StartGlueWorkflow');

    this.glueWorkflowCondition = new CfnCondition(this, 'GlueWorkflowCondition', {
      expression: Fn.conditionEquals(this.startGlueWorkflow.valueAsString, 'Yes')
    });

    this.glueOutputBucket = new Bucket(this, 'AvaGlueOutputBucket', {
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      serverAccessLogsPrefix: 'server-access-logs/',
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }
    });

    (this.glueOutputBucket.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;
    (this.glueOutputBucket.node.defaultChild as CfnResource).overrideLogicalId('AvaGlueOutputBucket');


    (this.glueOutputBucket.policy!.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;

    NagSuppressions.addResourceSuppressions(
        this.glueOutputBucket,
        [
            {
                id: "AwsSolutions-S10",
                reason: "Legacy code indicates that this is required to make the glue output process to work"
            }
        ],
        true
    );

    const glueDatabase = new Database(this, 'AvaGlueDatabase', { databaseName: 'amazon-virtual-andon-glue-database' });
    (glueDatabase.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;
    (glueDatabase.node.defaultChild as CfnResource).overrideLogicalId('AvaGlueDatabase');
    this.glueDatabaseName = glueDatabase.databaseName;

    const glueIssuesTable = new GlueTable(this, 'AvaGlueIssuesTable', {
      catalogId: Aws.ACCOUNT_ID,
      databaseName: glueDatabase.databaseName,
      tableInput: {
        storageDescriptor: {
          columns: [
            { name: 'eventid', type: 'string' },
            { name: 'acknowledged', type: 'string' },
            { name: 'created', type: 'string' },
            { name: 'sitename', type: 'string' },
            { name: 'issuesource', type: 'string' },
            { name: 'priority', type: 'string' },
            { name: 'areaname#status#processname#eventdescription#stationname#devicename#created', type: 'string' },
            { name: 'version', type: 'bigint' },
            { name: 'devicename', type: 'string' },
            { name: 'devicename#eventid', type: 'string' },
            { name: 'createdat', type: 'string' },
            { name: 'areaname', type: 'string' },
            { name: 'processname', type: 'string' },
            { name: 'createddateutc', type: 'date' },
            { name: 'eventdescription', type: 'string' },
            { name: 'areaname#status#processname#stationname#devicename#created', type: 'string' },
            { name: 'stationname', type: 'string' },
            { name: 'id', type: 'string' },
            { name: 'acknowledgedtime', type: 'bigint' },
            { name: 'status', type: 'string' },
            { name: 'updatedat', type: 'string' },
            { name: 'closed', type: 'string' },
            { name: 'resolutiontime', type: 'bigint' },
            { name: 'createdby', type: 'string' },
            { name: 'acknowledgedby', type: 'string' },
            { name: 'closedby', type: 'string' },
            { name: 'rejectedby', type: 'string' },
            { name: 'additionaldetails', type: 'string' }
          ],
          location: `s3://${this.glueOutputBucket.bucketName}/${this.glueOutputObjectPrefix}/issues`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          compressed: false,
          numberOfBuckets: -1,
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
            parameters: { 'serialization.format': '1' }
          },
          storedAsSubDirectories: false
        },
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          EXTERNAL: 'TRUE',
          has_encrypted_data: 'false',
          classification: 'parquet'
        }
      }
    });
    this.glueIssuesTableName = glueIssuesTable.ref;
    glueIssuesTable.overrideLogicalId('AvaGlueIssuesTable');
    glueIssuesTable.cfnOptions.condition = this.glueWorkflowCondition;

    const glueDataHierarchyTable = new GlueTable(this, 'AvaGlueDataHierarchyTable', {
      catalogId: Aws.ACCOUNT_ID,
      databaseName: glueDatabase.databaseName,
      tableInput: {
        storageDescriptor: {
          columns: [
            { name: 'protocol', type: 'string' },
            { name: 'endpoint', type: 'string' },
            { name: 'filterpolicy', type: 'string' },
            { name: 'id', type: 'string' },
            { name: 'type', type: 'string' },
            { name: 'subscriptionarn', type: 'string' },
            { name: 'stationareaid', type: 'string' },
            { name: 'createdat', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'version', type: 'bigint' },
            { name: 'parentid', type: 'string' },
            { name: 'updatedat', type: 'string' },
            { name: 'processareaid', type: 'string' },
            { name: 'eventprocessid', type: 'string' },
            { name: 'eventtype', type: 'string' },
            { name: 'priority', type: 'string' },
            { name: 'rootcauses', type: 'string' },
            { name: 'sms', type: 'string' },
            { name: 'eventimgkey', type: 'string' },
            { name: 'email', type: 'string' },
            { name: 'devicestationid', type: 'string' },
            { name: 'areasiteid', type: 'string' },
            { name: 'alias', type: 'string' }
          ],
          location: `s3://${this.glueOutputBucket.bucketName}/${this.glueOutputObjectPrefix}/data-hierarchy`,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          compressed: false,
          numberOfBuckets: -1,
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
            parameters: { 'serialization.format': '1' }
          },
          storedAsSubDirectories: false
        },
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          EXTERNAL: 'TRUE',
          has_encrypted_data: 'false',
          classification: 'parquet'
        }
      }
    });
    this.glueDataHierarchyTableName = glueDataHierarchyTable.ref;
    glueDataHierarchyTable.overrideLogicalId('AvaGlueDataHierarchyTable');
    glueDataHierarchyTable.cfnOptions.condition = this.glueWorkflowCondition;

    const crawlerRole = new Role(this, 'CrawlerRole', {
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
      inlinePolicies: {
        'DDBPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:Scan', 'dynamodb:DescribeTable'],
              resources: [`${props.issuesTable.tableArn}*`, `${props.dataHierarchyTable.tableArn}*`]
            })
          ]
        })
      }
    });
    (crawlerRole.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;

    const crawler = new GlueCrawler(this, 'Crawler', {
      name: 'amazon-virtual-andon-crawler',
      role: crawlerRole.roleArn,
      databaseName: glueDatabase.databaseName,
      targets: {
        dynamoDbTargets: [
          { path: props.issuesTable.tableName },
          { path: props.dataHierarchyTable.tableName }
        ]
      }
    });
    crawler.cfnOptions.condition = this.glueWorkflowCondition;

    NagSuppressions.addResourceSuppressions(
        crawlerRole,
        [
            {
                id: "AwsSolutions-IAM4",
                reason: "Legacy code requires managed policy, to be addressed in future"
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "Legacy code requires wildcards on end of dynamo table ARNs, may not be necessary"
            }
        ],
        true
    );

    const cleanupJob = this.getCleanupJob();
    cleanupJob.cfnOptions.condition = this.glueWorkflowCondition;

    const workflow = new GlueWorkflow(this, 'AvaEtlWorkflow', {
      description: `Workflow for ${Aws.STACK_NAME} CloudFormation stack`
    });
    workflow.cfnOptions.condition = this.glueWorkflowCondition;

    const etlCleanupJobTrigger = new GlueTrigger(this, 'EtlCleanupJobTrigger', {
      name: `${Aws.STACK_NAME}-EtlCleanupJobTrigger`,
      description: 'Starts the first job (cleanup job) in the ETL workflow. This job will clean any data from S3 that resulted from a prior ETL workflow',
      actions: [{ jobName: cleanupJob.ref }],
      type: 'SCHEDULED',
      schedule: Schedule.cron({ weekDay: 'MON', hour: '00', minute: '00' }).expressionString,
      startOnCreation: true,
      workflowName: workflow.ref
    });

    etlCleanupJobTrigger.cfnOptions.condition = this.glueWorkflowCondition;

    new GlueTrigger(this, 'EtlCrawlerTrigger', {  // NOSONAR: typescript:S1848
      name: `${Aws.STACK_NAME}-EtlCrawlerTrigger`,
      description: 'Crawls the DynamoDB table to update the Glue Data Catalog',
      actions: [{ crawlerName: crawler.ref }],
      type: 'CONDITIONAL',
      predicate: {
        conditions: [{
          jobName: cleanupJob.ref,
          logicalOperator: 'EQUALS',
          state: 'SUCCEEDED'
        }]
      },
      startOnCreation: true,
      workflowName: workflow.ref
    }).cfnOptions.condition = this.glueWorkflowCondition;

    const dataExportJob = this.getDataExportJob();
    dataExportJob.cfnOptions.condition = this.glueWorkflowCondition;

    new GlueTrigger(this, 'EtlIssuesDataExportJobTrigger', {  // NOSONAR: typescript:S1848
      name: `${Aws.STACK_NAME}-EtlIssuesDataExportJobTrigger`,
      description: 'Runs ETL for the Issues table to S3',
      actions: [{ jobName: dataExportJob.ref, arguments: { '--job_type': 'issues' } }],
      type: 'CONDITIONAL',
      predicate: {
        conditions: [{
          crawlerName: crawler.ref,
          logicalOperator: 'EQUALS',
          crawlState: 'SUCCEEDED'
        }]
      },
      startOnCreation: true,
      workflowName: workflow.ref
    }).cfnOptions.condition = this.glueWorkflowCondition;

    new GlueTrigger(this, 'EtlDataHierarchyDataExportJobTrigger', { // NOSONAR: typescript:S1848
      name: `${Aws.STACK_NAME}-EtlDataHierarchyDataExportJobTrigger`,
      description: 'Runs ETL for the Data Hierarchy table to S3',
      actions: [{ jobName: dataExportJob.ref, arguments: { '--job_type': 'hierarchy' } }],
      type: 'CONDITIONAL',
      predicate: {
        conditions: [{
          crawlerName: crawler.ref,
          logicalOperator: 'EQUALS',
          crawlState: 'SUCCEEDED'
        }]
      },
      startOnCreation: true,
      workflowName: workflow.ref
    }).cfnOptions.condition = this.glueWorkflowCondition;
  }

  /**
   * Creates a job that deletes any previous data that was exported from DynamoDB to S3 so
   * the current ETL job will represent the current state of the DynamoDB tables
   */
  private getCleanupJob(): GlueJob {
    const scriptFileName = 'etl-cleanup.py';

    const glueJobRole = new Role(this, 'AvaEtlCleanupJobRole', {
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
      inlinePolicies: {
        'S3Policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [this.sourceCodeBucket.arnForObjects(`${this.sourceCodeKeyPrefix}/glue-job-scripts/${scriptFileName}`)]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:DeleteObject'],
              resources: [this.glueOutputBucket.arnForObjects(`${this.glueOutputObjectPrefix}*`)]
            })
          ]
        })
      }
    });

    NagSuppressions.addResourceSuppressions(
        glueJobRole,
        [
            {
                id: "AwsSolutions-IAM4",
                reason: "Legacy code requires managed policy, to be addressed in future"
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "Legacy code requires delete object on glue bucket but uses prefix"
            }
        ],
        true
    );

    (glueJobRole.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;

    return new GlueJob(this, 'AvaEtlCleanupJob', {
      role: glueJobRole.roleArn,
      name: 'amazon-virtual-andon-etl-cleanup',
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: `s3://${this.sourceCodeBucket.bucketName}/${this.sourceCodeKeyPrefix}/glue-job-scripts/${scriptFileName}`
      },
      executionProperty: { maxConcurrentRuns: 1 },
      timeout: 60,  // 1 hour
      glueVersion: '2.0',
      numberOfWorkers: 2,
      workerType: 'Standard',
      defaultArguments: {
        '--job-language': 'python',
        '--job-bookmark-option': 'job-bookmark-enable',
        '--enable-metrics': '',
        '--glue_output_bucket': this.glueOutputBucket.bucketName,
        '--glue_output_s3_key_prefix': this.glueOutputObjectPrefix,
        '--region': Aws.REGION,
        '--solution_id': this.solutionId,
        '--solution_version': this.solutionVersion
      }
    });
  }

  /**
   * Creates a job that will load data from the supplied DynamoDB Table to S3 so it can be analyzed with Athena
   */
  private getDataExportJob(): GlueJob {
    const scriptFileName = 'etl-data-export.py';

    const glueJobRole = new Role(this, 'AvaEtlDataExportJobRole', {
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
      inlinePolicies: {
        'DDBPolicy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['dynamodb:Scan', 'dynamodb:DescribeTable'],
              resources: [this.ddbIssuesTable.tableArn, this.ddbDataHierarchyTable.tableArn]
            })
          ]
        }),
        'S3Policy': new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetObject'],
              resources: [this.sourceCodeBucket.arnForObjects(`${this.sourceCodeKeyPrefix}/glue-job-scripts/${scriptFileName}`)]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject'],
              resources: [this.glueOutputBucket.arnForObjects('*')]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:GetBucketLocation', 's3:ListBucket', 's3:GetBucketAcl', 's3:CreateBucket'],
              resources: [this.glueOutputBucket.bucketArn]
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ['s3:ListAllMyBuckets'],
              resources: ['*']
            })
          ]
        })
      }
    });

    (glueJobRole.node.defaultChild as CfnResource).cfnOptions.condition = this.glueWorkflowCondition;
    addCfnSuppressRules(glueJobRole, [{ id: 'W11', reason: '* is required for the s3:ListAllMyBuckets permission' }]);

    NagSuppressions.addResourceSuppressions(
        glueJobRole,
        [
            {
                id: "AwsSolutions-IAM4",
                reason: "Legacy code requires managed policy, to be addressed in future"
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "Legacy code requires listing all buckets in account"
            }
        ],
        true
    );

    return new GlueJob(this, 'AvaEtlDataExportJob', {
      role: glueJobRole.roleArn,
      name: 'amazon-virtual-andon-etl-data-export',
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: `s3://${this.sourceCodeBucket.bucketName}/${this.sourceCodeKeyPrefix}/glue-job-scripts/${scriptFileName}`
      },
      executionProperty: { maxConcurrentRuns: 2 },
      timeout: 60,  // 1 hour
      glueVersion: '2.0',
      numberOfWorkers: 2,
      workerType: 'Standard',
      defaultArguments: {
        '--job-language': 'python',
        '--job-bookmark-option': 'job-bookmark-enable',
        '--enable-metrics': '',
        '--ddb_issues_table_name': this.ddbIssuesTable.tableName,
        '--ddb_data_hierarchy_table_name': this.ddbDataHierarchyTable.tableName,
        '--glue_issues_table_name': this.glueIssuesTableName,
        '--glue_data_hierarchy_table_name': this.glueDataHierarchyTableName,
        '--glue_db_name': this.glueDatabaseName,
        '--glue_output_bucket': this.glueOutputBucket.bucketName,
        '--region': Aws.REGION,
        '--solution_id': this.solutionId,
        '--solution_version': this.solutionVersion
      }
    });
  }
}
