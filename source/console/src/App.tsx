// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React, Amplify, and AWS SDK packages
import React from 'react';
import NotificationSystem from 'react-notification-system';
import Amplify from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { AuthState } from "@aws-amplify/ui-components";
import { Logger } from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import PubSub from '@aws-amplify/pubsub';
import { AWSIoTProvider } from '@aws-amplify/pubsub/lib/Providers';
import AWS from 'aws-sdk';

import Footer from './components/Footer';
import { LOGGING_LEVEL, handleSubscriptionError } from './util/CustomUtil';
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

/**
 * Types of subscriptions that will be maintained by the main App class
 */
export enum AppSubscriptionTypes {
  GROUP
}

// Logging
const LOGGER = new Logger('App', LOGGING_LEVEL);

// Declare Amazon Virtual Andon console configuration
declare let andon_config: any;
Amplify.addPluggable(new AWSIoTProvider({
  aws_pubsub_region: andon_config.aws_project_region,
  aws_pubsub_endpoint: andon_config.aws_iot_endpoint + '/mqtt'
}));
PubSub.configure(andon_config);
Amplify.configure(andon_config);
Amplify.configure({
  Storage: {
    bucket: andon_config.website_bucket,
    region: andon_config.aws_project_region
  }
});

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
    this.configureSubscription = this.configureSubscription.bind(this);
  }

  /**
   * React componentDidMount function
   */
   async componentDidMount() {
    await this.handleAuthStateChange(AuthState.SignedIn)
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
      message: (<div>{message}</div>),
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
    if (state === 'signedin') {
      const user = await Auth.currentAuthenticatedUser();
      const groups = user.signInUserSession.idToken.payload['cognito:groups'];

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
        await this.configureSubscription(AppSubscriptionTypes.GROUP);
      } catch (error) {
        LOGGER.error('Error occurred while attaching principal policy', error);
      }
    }
  }

  /**
   * Configures the subscription for the supplied `subscriptionType`
   * @param subscriptionType The type of subscription to configure
   * @param delayMS (Optional) This value will be used to set a delay for reestablishing the subscription if the socket connection is lost
   */
  async configureSubscription(subscriptionType: AppSubscriptionTypes, delayMS: number = 10): Promise<void> {
    try {
      if (subscriptionType === AppSubscriptionTypes.GROUP) {
        const user = await Auth.currentAuthenticatedUser();
        const userId = user.signInUserSession.idToken.payload.sub;

        if (this.groupSubscription) { this.groupSubscription.unsubscribe(); }

        // Subscribe user group change for the user
        this.groupSubscription = PubSub.subscribe(`ava/groups/${userId}`).subscribe({
          next: (data: any) => {
            // If user's group is changed, sign out the user.
            this.handleNotification(data.value, 'warning', 0);
            Auth.signOut();
            this.groupSubscription.unsubscribe();
          },
          error: async (e: any) => {
            await handleSubscriptionError(e, subscriptionType, this.configureSubscription, delayMS);
          }
        });
      }
    } catch (err) {
      console.error('Unable to configure subscription', err);
    }
  }

  /**
   * Render this page.
   */
  render() {
    return (
      <div>
        <NotificationSystem ref={this.notificationSystem} />
        <Main authState= {AuthState.SignedIn} routes={this.state.routes} handleNotification={this.handleNotification} />
        <Footer />
      </div>
    );
  }
}

export default withAuthenticator(App);