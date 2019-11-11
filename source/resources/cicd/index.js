/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

'use strict';

const fs = require('fs');
const request = require('superagent');
const admZip = require('adm-zip');
const Logger = require('logger');
const { promisify } = require("util");
const path = require('path');
const url = require('url');
const https = require('https');
const uuid = require('uuid');

const readdir = promisify(fs.readdir);
const fsstat = promisify(fs.stat);

const AWS = require('aws-sdk')
const codecommit = new AWS.CodeCommit({ apiVersion: '2015-04-13', region: process.env.AWS_REGION })

exports.handler = async (event, context) => {

  // send response back before function timeout
  setTimeout(sendResponse, context.getRemainingTimeInMillis() - 500, event, context.logStreamName, 'FAILED', { Err: 'cicd function timed out' })

  Logger.log(
    Logger.levels.ROBUST,
    `Received event: ${JSON.stringify(event, null, 2)}`
  );

  // Handling Promise Rejection
  process.on('unhandledRejection', error => {
    throw error;
  });
  /**
    * Create commit when the solution is created
    */
  if (event.ResourceType === 'Custom::CreateCommit') {
    if (event.RequestType === 'Create') {
      try {
        Logger.log(
          Logger.levels.ROBUST,
          `${event.LogicalResourceId}:${event.RequestType}`
        );
        const _repo = process.env.CODECOMMIT_REPO
        const _s3url = process.env.CODE_URL
        await downloadZip(_s3url)
        const data = await walk('/tmp/andon')
        let i, j, temparray, chunk = 99;
        let parentCommitId = ''
        let params = {}
        for (i = 0, j = data.length; i < j; i += chunk) {
          temparray = data.slice(i, i + chunk);
          const filesList = []
          for (let k = 0; k < temparray.length; k++) {
            const fileDetails = {
              filePath: temparray[k].split('andon/')[1],
              fileContent: Buffer.from(fs.readFileSync(temparray[k]))
            }
            filesList.push(fileDetails)
          }
          if (!parentCommitId) {
            params = {
              branchName: 'master', /* required */
              repositoryName: _repo, /* required */
              putFiles: filesList,
              authorName: 'andon-pipeline',
              commitMessage: 'initial commit for amazon virtual andon'
            }
          }
          else if (parentCommitId) {
            params = {
              branchName: 'master', /* required */
              repositoryName: _repo, /* required */
              parentCommitId: parentCommitId,
              putFiles: filesList,
              authorName: 'andon-pipeline',
              commitMessage: 'initial commit for amazon virtual andon, adding more code artifacts'
            }
          }

          Logger.log(
            Logger.levels.ROBUST,
            `params: ${params}`
          );
          const resp = await codecommit.createCommit(params).promise()
          parentCommitId = resp.commitId
        }

        const _responseData = {
          Method: `${event.LogicalResourceId}:${event.RequestType} `
        };

        await sendResponse(
          event,
          context.logStreamName,
          'SUCCESS',
          _responseData
        );
      } catch (err) {
        const _responseData = {
          Error: err,
        };
        await sendResponse(
          event,
          context.logStreamName,
          'FAILED',
          _responseData
        );
        throw new Error(err)
      }
    }
    else {
      let _responseData = {
        Method: `${event.LogicalResourceId}:${event.RequestType}`,
      };
      Logger.log(
        Logger.levels.ROBUST,
        `${event.LogicalResourceId}:${event.RequestType}`
      );

      await sendResponse(
        event,
        context.logStreamName,
        'SUCCESS',
        _responseData
      );
    }
  }

  /**
    * Create SSM Parameter
    */
  if (event.ResourceType === 'Custom::CreateSSMParameter') {
    if (event.RequestType === 'Create' || event.RequestType === 'Update') {
      try {
        Logger.log(
          Logger.levels.ROBUST,
          `event details: ${event.LogicalResourceId}:${event.RequestType}`
        );
        let _responseData = {
          Method: `${event.LogicalResourceId}:${event.RequestType}`,
        };

        const _accessKey = event.ResourceProperties.ANDON_ACCESS_KEY;
        const _secretKey = event.ResourceProperties.ANDON_SECRET_KEY;
        const _graphQLEndpoint = event.ResourceProperties.GRAPHQL_ENDPOINT_KEY;
        const _graphQLApi = event.ResourceProperties.GRAPHQL_API_KEY;
        const _cognitoAuthRole = event.ResourceProperties.COGNITO_AUTH_ROLE_KEY
        const _stackName = event.ResourceProperties.STACK_NAME;
        const _adminEmail = event.ResourceProperties.ADMIN_EMAIL;
        const _cognitoUserPoolId = event.ResourceProperties.USER_POOL_ID;
        const _cognitoStack = event.ResourceProperties.COGNITO_STACK;
        const data = await createSSMParameter(_accessKey, _secretKey, _graphQLEndpoint, _graphQLApi, _cognitoAuthRole, _stackName, _adminEmail, _cognitoUserPoolId, _cognitoStack)
        Logger.log(
          Logger.levels.ROBUST,
          `SSM Status: ${JSON.stringify(data)}`
        );
        await sendResponse(
          event,
          context.logStreamName,
          'SUCCESS',
          _responseData
        );
      } catch (err) {
        const _responseData = {
          Error: err,
        };
        Logger.error(
          Logger.levels.INFO,
          `Err: ${JSON.stringify(err, null, 2)}`
        );
        await sendResponse(
          event,
          context.logStreamName,
          'FAILED',
          _responseData
        );
        throw new Error(err)
      }
    } else {
      let _responseData = {
        Method: `${event.LogicalResourceId}:${event.RequestType}`,
      };
      Logger.log(
        Logger.levels.ROBUST,
        `${event.LogicalResourceId}:${event.RequestType}`
      );

      await sendResponse(
        event,
        context.logStreamName,
        'SUCCESS',
        _responseData
      );
    }
  }

  /**
    * Handle Amplify stack deletion 
    */
  if (event.ResourceType === 'Custom::DeleteStack') {
    if (event.RequestType === 'Delete') {
      try {
        Logger.log(
          Logger.levels.ROBUST,
          `event details: ${event.LogicalResourceId}:${event.RequestType}`
        );
        const cloudformation = new AWS.CloudFormation({ apiVersion: '2010-05-15' });
        const ssm = new AWS.SSM({ apiVersion: '2014-11-06' });
        const iam = new AWS.IAM({ apiVersion: '2010-05-08' });
        const s = await ssm.getParameter({ Name: event.ResourceProperties.STACK_NAME, WithDecryption: true }).promise()
        const cs = await ssm.getParameter({ Name: event.ResourceProperties.COGNITO_STACK, WithDecryption: true }).promise()
        const cogAuth = await ssm.getParameter({ Name: event.ResourceProperties.COGNITO_AUTH_ROLE_KEY, WithDecryption: true }).promise()
        const roleName = cogAuth.Parameter.Value.split('/')[1]
        Logger.log(
          Logger.levels.ROBUST,
          `stack names: ${s.Parameter.Value}, ${cs.Parameter.Value}`
        );
        // remove attached IAM policies from Cognito Auth role
        try {
          await iam.deleteRolePolicy({ PolicyName: "AndonSNSPolicy", RoleName: roleName }).promise();
          await iam.detachRolePolicy({ PolicyArn: "arn:aws:iam::aws:policy/AWSIoTConfigAccess", RoleName: roleName }).promise()
          await iam.detachRolePolicy({ PolicyArn: "arn:aws:iam::aws:policy/AWSIoTDataAccess", RoleName: roleName }).promise()
          await iam.detachRolePolicy({ PolicyArn: "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess", RoleName: roleName }).promise()
        }
        catch (e) {
          Logger.error(
            Logger.levels.INFO,
            `${JSON.stringify(e, null, 2)}`
          );
        }
        // delete cognito resources stack
        try {
          await cloudformation.deleteStack({ StackName: cs.Parameter.Value }).promise()
          await cloudformation.waitFor('stackDeleteComplete', { StackName: cs.Parameter.Value }).promise()
        }
        catch (e) {
          Logger.error(Logger.levels.INFO,
            `stack deletion error: ${JSON.stringify({
              StackName: cs.Parameter.Value,
              DeletionError: e
            }, null, 2)}`)
        }

        try {
          // delete amplify parent stack
          await cloudformation.deleteStack({ StackName: s.Parameter.Value }).promise()
          await cloudformation.waitFor('stackDeleteComplete', { StackName: s.Parameter.Value }).promise()
        }
        catch (e) {
          Logger.error(Logger.levels.INFO,
            `stack deletion error: ${JSON.stringify({
              StackName: s.Parameter.Value,
              DeletionError: e
            }, null, 2)}`)
        }
      }
      catch (err) {
        const _responseData = {
          Error: err,
        };
        await sendResponse(
          event,
          context.logStreamName,
          'FAILED',
          _responseData
        );
        throw new Error(err)
      }

      const _responseData = {
        Method: `${event.LogicalResourceId}:${event.RequestType}`
      };

      await sendResponse(
        event,
        context.logStreamName,
        'SUCCESS',
        _responseData
      );

    } else {
      let _responseData = {
        Method: `${event.LogicalResourceId}:${event.RequestType}`,
      };
      Logger.log(
        Logger.levels.ROBUST,
        `${event.LogicalResourceId}:${event.RequestType}`
      );

      await sendResponse(
        event,
        context.logStreamName,
        'SUCCESS',
        _responseData
      );
    }
  }

  /**  
    * Handle UUID creation
    */
  if (event.ResourceType === 'Custom::UUID') {
    if (event.RequestType === 'Create') {
      try {

        Logger.log(
          Logger.levels.ROBUST,
          `${event.LogicalResourceId}:${event.RequestType}`
        );

        const _responseData = {
          Method: `${event.LogicalResourceId}:${event.RequestType} `,
          UUID: `${uuid.v4()}`
        };

        await sendResponse(
          event,
          context.logStreamName,
          'SUCCESS',
          _responseData
        );
      } catch (err) {
        const _responseData = {
          Error: err,
        };
        await sendResponse(
          event,
          context.logStreamName,
          'FAILED',
          _responseData
        );
        throw new Error(err)
      }
    }
    else {
      let _responseData = {
        Method: `${event.LogicalResourceId}:${event.RequestType}`,
      };
      Logger.log(
        Logger.levels.ROBUST,
        `${event.LogicalResourceId}:${event.RequestType}`
      );

      await sendResponse(
        event,
        context.logStreamName,
        'SUCCESS',
        _responseData
      );
    }
  }

}
/**
 * Create SSM Parameter if it doesn't exist
 */
const createSSMParameter = async (accessKey, secretKey, graphQLEndpoint, graphQLApi, cognitoAuthRole, stackName, adminEmail, cognitoUserPoolId, cognitoStack) => {
  const ssm = new AWS.SSM();
  try {
    const data = await ssm
      .getParameters({ Names: [accessKey, secretKey, graphQLEndpoint, graphQLApi, cognitoAuthRole, stackName, adminEmail, cognitoUserPoolId, cognitoStack], WithDecryption: true })
      .promise();
    Logger.log(
      Logger.levels.ROBUST,
      `${JSON.stringify(
        {
          SSMParameter: {
            create: 'true',
            parameters: data.InvalidParameters,
          },
        },
        null,
        2
      )}`
    );
    await Promise.all(
      data.InvalidParameters.map(ssmParam => {
        Logger.log(Logger.levels.ROBUST, `ssm parameter: ${ssmParam}`)
        ssm.putParameter({
          Name: ssmParam /* required */,
          Type: 'SecureString' /* required */,
          Value: 'ANDON_DUMMY' /* required */,
          Tags: [
            {
              Key: 'SOLUTION_NAME', /* required */
              Value: process.env.SOLUTION_NAME /* required */
            }]
        })
          .promise();
      })
    );
    return ('ssm parameter creation successful')
    // successful response 👌
  } catch (err) {
    Logger.error(
      Logger.levels.INFO,
      `${JSON.stringify(
        {
          accessKey: accessKey,
          secretKey: secretKey,
          graphqlEndpoint: graphQLEndpoint,
          graphqlApi: graphQLApi,
          cognitoAuthRole: cognitoAuthRole,
          stackName: stackName,
          adminEmail: adminEmail,
          cognitoUserPoolId: cognitoUserPoolId,
          cognitoStack: cognitoStack,
          error: err
          // an error occurred 🔥
        },
        null,
        2
      )}`
    );
    return ('ssm parameter creation unsuccessful')
  }
}

const downloadZip = async (_s3url) => {
  await new Promise((resolve, reject) => {
    const outputDir = `/tmp/andon/`;
    const zipFile = '/tmp/andon.zip';
    request
      .get(_s3url)
      .on('error', function (error) {
        Logger.error(Logger.levels.INFO, error);
        reject(error)
      })
      .pipe(fs.createWriteStream(zipFile))
      .on('finish', function () {
        Logger.log(Logger.levels.ROBUST, 'finished downloading');
        var zip = new admZip(zipFile);
        Logger.log(Logger.levels.ROBUST, 'start unzipping');
        zip.extractAllTo(outputDir, /*overwrite*/true);
        Logger.log(Logger.levels.ROBUST, 'finished unzipping');
        resolve('finished unzip');
      });
  })
}

const walk = async (dir, filelist = []) => {
  const files = await readdir(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stat = await fsstat(filepath);

    if (stat.isDirectory()) {
      filelist = await walk(filepath, filelist);
    } else {
      filelist.push(filepath);

    }
  }

  return filelist;
}

/**
 * Sends a response to the pre-signed S3 URL
 */
const sendResponse = async (event,
  logStreamName,
  responseStatus,
  responseData) => {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${logStreamName} `,
    PhysicalResourceId: logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  Logger.log(
    Logger.levels.ROBUST,
    `RESPONSE BODY: ${responseBody}`
  );
  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options,
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk.toString()));
        res.on('error', reject);
        res.on('end', () => {
          Logger.log(
            Logger.levels.ROBUST,
            `SIGANL SENT STATUS: ${res.statusCode}`
          );
          Logger.log(
            Logger.levels.ROBUST,
            `HEADERS: ${JSON.stringify(res.headers)}`
          );
          if (res.statusCode >= 200 && res.statusCode <= 299) {
            Logger.log(
              Logger.levels.INFO,
              `Successfully sent stack response`
            );
            resolve({ statusCode: res.statusCode, headers: res.headers });
          } else {
            reject('Request failed status: ' + res.statusCode);
          }
        });
      });
    req.on('error', reject);
    req.write(responseBody);
    req.end();
  });
};
