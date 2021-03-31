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

// Import React, Amplify, and AWS SDK packages
import React from 'react';
import NotificationSystem from 'react-notification-system';
import Amplify, { PubSub } from 'aws-amplify';
import { Authenticator } from 'aws-amplify-react';
import { Logger } from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import { AWSIoTProvider } from '@aws-amplify/pubsub/lib/Providers';
import AWS from 'aws-sdk';

// Import custom setting including customized Amplify, footer, and util
import CustomSignIn from './components/amplify-authentication/CustomSignIn';
import CustomRequireNewPassword from './components/amplify-authentication/CustomRequireNewPassword';
import CustomForgotPassword from './components/amplify-authentication/CustomForgotPassword';
import CustomVerifyContact from './components/amplify-authentication/CustomVerifyContact';
import Footer from './components/Footer';
import { LOGGING_LEVEL, getAmplifyCustomErrorMessage } from './util/CustomUtil';
import { adminRoutes, managerRoutes, engineerRoutes, associateRoutes } from './components/Routes';
import { IRoute } from './components/Interfaces';

// Import views
import Main from './views/Main';

/**
 * Properties Interface
 * @interface IPros
 */
interface IProps {
  authState?: any;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  routes: IRoute[];
}

// Logging
const LOGGER = new Logger('App', LOGGING_LEVEL);

// Declare Amazon Virtual Andon console configuration
declare var andon_config: any;
Amplify.addPluggable(new AWSIoTProvider({
  aws_pubsub_region: andon_config.aws_project_region,
  aws_pubsub_endpoint: andon_config.aws_iot_endpoint + '/mqtt'
}));

/**
 * The default application
 * @class App
 */
class App extends React.Component<IProps, IState> {
  // User group change subscription
  private groupSubscription: any;
  // Notification
  private notificationSystem = React.createRef<any>();

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      routes: []
    };

    this.groupSubscription = null;

    this.handleNotification = this.handleNotification.bind(this);
    this.handleAuthStateChange = this.handleAuthStateChange.bind(this);
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    if (this.groupSubscription) this.groupSubscription.unsubscribe();
  }

  /**
   * Handle notification.
   * @param {string} message - Notification message
   * @param {string} level - Notification level
   * @param {number} autoDismiss - Notification auto dismiss second
   */
  handleNotification(message: string, level: string, autoDismiss: number) {
    const notification = this.notificationSystem.current;

    notification.addNotification({
      message: ( <div>{message}</div> ),
      level,
      position: 'tr',
      autoDismiss
    });
  }

  /**
   * Handle auth state change.
   * @param {string} state - Amplify auth state
   */
  async handleAuthStateChange(state: string) {
    if (state === 'signedIn') {
      const user = await Auth.currentAuthenticatedUser();
      const groups = user.signInUserSession.idToken.payload['cognito:groups'];
      const userId = user.signInUserSession.idToken.payload.sub;

      if (!groups) {
        this.setState({ routes: [] });
      } else if (groups.includes('AdminGroup')) {
        this.setState({ routes: adminRoutes });
      } else if (groups.includes('ManagerGroup')) {
        this.setState({ routes: managerRoutes });
      } else if (groups.includes('EngineerGroup')) {
        this.setState({ routes: engineerRoutes });
      } else if (groups.includes('AssociateGroup')) {
        this.setState({ routes: associateRoutes });
      } else {
        this.setState({ routes: [] });
      }

      // IoT policy is necessary to connect, publish, subscribe, and receive message.
      const credentials = await Auth.currentCredentials();
      AWS.config.update({
        region: andon_config.aws_project_region,
        credentials: Auth.essentialCredentials(credentials)
      });

      const identityId = credentials.identityId;
      const params = {
        policyName: andon_config.aws_iot_policy_name,
        principal: identityId
      };

      try {
        await new AWS.Iot().attachPrincipalPolicy(params).promise();

        // Subscribe user group change for the user
        this.groupSubscription = PubSub.subscribe(`ava/groups/${userId}`).subscribe({
          next: (data: any) => {
            // If user's group is changed, sign out the user.
            this.handleNotification(data.value, 'warning', 0);
            Auth.signOut();
            this.groupSubscription.unsubscribe();
          },
          error: () => {
            // If there's an error (e.g. connection closed), reload the window.
            window.location.reload();
          }
        });
      } catch (error) {
        LOGGER.error('Error occurred while attaching princial policy', error);
      }
    }
  }

  /**
   * Render this page.
   */
  render() {
    return (
      <Authenticator hideDefault={true} amplifyConfig={andon_config} onStateChange={this.handleAuthStateChange} errorMessage={getAmplifyCustomErrorMessage}>
        <NotificationSystem ref={this.notificationSystem} />
        <CustomSignIn />
        <CustomRequireNewPassword />
        <CustomForgotPassword />
        <CustomVerifyContact />
        <Main routes={this.state.routes} handleNotification={this.handleNotification} />
        <Footer />
      </Authenticator>
    );
  }
}

export default App;