/**********************************************************************************************************************
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

 // Import Amplify and AWS SDK
 import { I18n } from 'aws-amplify';
import { Logger, ICredentials } from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import AWS from 'aws-sdk';

// Import custom setting including customized Amplify, footer, and util
import { LOGGING_LEVEL, CustomError, validateEmailAddress } from './CustomUtil';
import { IUser } from '../components/Interfaces';

// Logging
const LOGGER = new Logger('CognitoController', LOGGING_LEVEL);

// Unauthorized error
const UNAUTHORIZED_ERROR = {
  errorType: 'Unauthorized',
  message: I18n.get('error.unauthorized.user')
};

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;

/**
 * Amazon Cognito controller class.
 * @class CognitoController
 */
class CognitoController {
  // User pool ID
  private userPoolId: string;
  // Cognito Identity Service Provider
  private cognitoIdentityServiceProvider: AWS.CognitoIdentityServiceProvider;

  /**
   * @constructor
   * @param {ICredentials} credentials - AWS credentials
   */
  constructor(credentials: ICredentials) {
    this.userPoolId = andon_config.aws_user_pools_id;

    // Set AWS credential
    AWS.config.update({
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(credentials)
    });
    this.cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({ region: andon_config.aws_project_region });
  }

  /**
   * Check if the user is authorized to perform the action.
   * @return {boolean} If the user is authorized or not
   */
  private async isAuthorized(): Promise<boolean> {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const groups = await this.getUserGroups(user.username);
      if (groups.includes('AdminGroup')) {
        return true;
      } else {
        LOGGER.error('The user is unauthorized to perform the action.');
        return false;
      }
    } catch (error) {
      LOGGER.error('Error occurred while checking user authorization.');
      LOGGER.debug(error);

      return false;
    }
  }

  /**
   * Get the user's user groups.
   * @param {string} username - User name to get the user groups
   * @return {Promise<string[]>} The user groups
   */
  async getUserGroups(username: string): Promise<string[]> {
    const params = {
      UserPoolId: this.userPoolId,
      Username: username
    };

    try {
      const response = await this.cognitoIdentityServiceProvider.adminListGroupsForUser(params).promise();

      if (response.Groups && response.Groups.length > 0) {
        return (response.Groups.map(group => group.GroupName) as string[]);
      } else {
        return [];
      }
    } catch (error) {
      LOGGER.error('Error occurred while getting user groups.');
      LOGGER.debug(error);

      return [];
    }
  }

  /**
   * Get the list of users.
   * @return {Promise<IUser[]>} The list of users
   */
  async listUsers(): Promise<IUser[]> {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      try {
        let params: any = {
          UserPoolId: this.userPoolId
        };
        let users: IUser[] = [];
        let paginationToken: string | undefined = '';

        do {
          let response = await this.cognitoIdentityServiceProvider.listUsers(params).promise();
          paginationToken = response.PaginationToken;

          if (response.Users && response.Users.length > 0) {
            for (let user of response.Users) {
              users.push(
                {
                  username: user.Username as string,
                  status: user.UserStatus as string,
                  groups: [],
                  userId: this.getCognitoAttributeValue('sub', user.Attributes)
                }
              );
            }

            params.PaginationToken = paginationToken;
          }
        } while (paginationToken);

        return users;
      } catch (error) {
        LOGGER.error('Error occurred while getting users.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'ListUsersError',
          message: I18n.get('error.get.users')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Get the list of associate group users only.
   * @return {Promise<IUser[]>} The list of associate group users
   */
  async listAssociateGroupUsers(): Promise<IUser[]> {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      try {
        let params: any = {
          GroupName: 'AssociateGroup',
          UserPoolId: this.userPoolId
        };
        let users: IUser[] = [];
        let nextToken: string | undefined = '';

        do {
          let response = await this.cognitoIdentityServiceProvider.listUsersInGroup(params).promise();
          nextToken = response.NextToken;

          if (response.Users && response.Users.length > 0) {
            for (let user of response.Users) {
              users.push(
                {
                  username: user.Username as string,
                  status: user.UserStatus as string,
                  groups: ['AssociateGroup'],
                  userId: this.getCognitoAttributeValue('sub', user.Attributes)
                }
              );
            }

            params.NextToken = nextToken;
          }
        } while (nextToken);

        return users;
      } catch (error) {
        LOGGER.error('Error occurred while getting associate group users.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'ListAssociateGroupUsersError',
          message: I18n.get('error.get.associate.group.users')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Get the user's detail information.
   * @param {string} username - The user name to get the user detail information
   * @return {Promise<IUser>} The user detail information
   */
  async getUser(username: string): Promise<IUser> {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      if (!validateEmailAddress(username)) {
        throw new CustomError({
          errorType: 'InvalidFormatError',
          message: I18n.get('error.invalid.username')
        });
      }

      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      try {
        const response = await this.cognitoIdentityServiceProvider.adminGetUser(params).promise();
        const groups = await this.getUserGroups(username);
        return {
          username: response.Username,
          status: response.UserStatus as string,
          groups: groups,
          userId: this.getCognitoAttributeValue('sub', response.UserAttributes)
        };
      } catch (error) {
        LOGGER.error('Error occurred while getting a user.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'GetUserError',
          message: I18n.get('error.get.user')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Add a user.
   * @param {IUser} user - A user to add
   */
  async addUser(user: IUser) {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      if (!validateEmailAddress(user.username)) {
        throw new CustomError({
          errorType: 'InvalidFormatError',
          message: I18n.get('error.invalid.username')
        });
      }

      const params = {
        UserPoolId: this.userPoolId,
        Username: user.username,
        UserAttributes: [
          {
            Name: 'email',
            Value: user.username
          }
        ]
      };

      try {
        const response = await this.cognitoIdentityServiceProvider.adminCreateUser(params).promise();
        user.status = response.User?.UserStatus as string;
        user.userId = this.getCognitoAttributeValue('sub', response.User?.Attributes);

        // Set user groups
        await this.setUserGourps(user.username, user.groups);

        return user;
      } catch (error) {
        LOGGER.error('Error occurred while adding a user.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'AddUserError',
          message: I18n.get('error.add.user')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Edit a user.
   * @param {IUser} user - The user to edit
   */
  async editUser(user: IUser) {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      if (!validateEmailAddress(user.username)) {
        throw new CustomError({
          errorType: 'InvalidFormatError',
          message: I18n.get('error.invalid.username')
        });
      }

      try {
        const currentUser = await this.getUser(user.username);
        const currentGroups = currentUser.groups;
        const removeGroups = currentGroups.filter(group => !user.groups.includes(group));
        const addGroups = user.groups.filter(group => !currentGroups.includes(group));

        const promises = [
          this.removeUserGroups(user.username, removeGroups),
          this.setUserGourps(user.username, addGroups)
        ];

        await Promise.all(promises);
      } catch (error) {
        LOGGER.error('Error occurred while editing the user.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'EditUserError',
          message: I18n.get('error.edit.user')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Delete a user.
   * @param {string} username - The user name to delete the user
   */
  async deleteUser(username: string) {
    const isAuthorized = await this.isAuthorized();
    if (isAuthorized) {
      if (!validateEmailAddress(username)) {
        throw new CustomError({
          errorType: 'InvalidFormatError',
          message: I18n.get('error.invalid.username')
        });
      }

      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      try {
        await this.cognitoIdentityServiceProvider.adminDeleteUser(params).promise();
      } catch (error) {
        LOGGER.error('Error occurred while deleting the user.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'DeleteUserError',
          message: I18n.get('error.delete.user')
        });
      }
    } else {
      throw new CustomError(UNAUTHORIZED_ERROR);
    }
  }

  /**
   * Set user groups to a user.
   * @param {string} username - The user name to set the user groups
   * @param {string[]} groups - The user groups to assign the user
   */
  private async setUserGourps(username: string, groups: string[]) {
    if (!validateEmailAddress(username)) {
      throw new CustomError({
        errorType: 'InvalidFormatError',
        message: I18n.get('error.invalid.username')
      });
    }

    try {
      const promises = [];

      for (let group of groups) {
        const params = {
          UserPoolId: this.userPoolId,
          Username: username,
          GroupName: group
        };
        promises.push(this.cognitoIdentityServiceProvider.adminAddUserToGroup(params).promise());
      }

      await Promise.all(promises);
    } catch (error) {
      LOGGER.error('Error occurred while setting user group.');
      LOGGER.debug(error);

      throw new CustomError({
        errorType: 'SetUserGroupError',
        message: I18n.get('error.set.user.group')
      });
    }
  }

  /**
   * Remove user groups from a user.
   * @param {string} username - The user name to remove the user groups
   * @param {string[]} groups - The user groups to remove from the user
   */
  private async removeUserGroups(username: string, groups: string[]) {
    if (!validateEmailAddress(username)) {
      throw new CustomError({
        errorType: 'InvalidFormatError',
        message: I18n.get('error.invalid.username')
      });
    }

    if (groups.length > 0) {
      try {
        const promises = [];

        for (let group of groups) {
          const params = {
            UserPoolId: this.userPoolId,
            Username: username,
            GroupName: group
          };
          promises.push(this.cognitoIdentityServiceProvider.adminRemoveUserFromGroup(params).promise());
        }

        await Promise.all(promises);
      } catch (error) {
        LOGGER.error('Error occurred while removing user group.');
        LOGGER.debug(error);

        throw new CustomError({
          errorType: 'RemoveUserGroupError',
          message: I18n.get('error.remove.user.group')
        });
      }
    }
  }

  /**
   * Get Cognito user attribute value by name.
   * @param {string} name - The name of Cognito user attribute
   * @param {AWS.CognitoIdentityServiceProvider.AttributeType | undefined} attributes - The Cognito user attribute
   * @return {string} The attribute value
   */
  getCognitoAttributeValue(name: string, attributes?: AWS.CognitoIdentityServiceProvider.AttributeType[]): string {
    if (attributes) {
      for (let attribute of attributes) {
        if (attribute.Name === name) {
          if (attribute.Value) {
            return attribute.Value;
          } else {
            return '';
          }
        }
      }
    }

    return '';
  }
}

export default CognitoController;