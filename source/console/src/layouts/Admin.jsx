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

import React, { Component } from "react";
import { Route, Switch } from "react-router-dom";
import NotificationSystem from "react-notification-system";
import { withAuthenticator } from "aws-amplify-react";
import Amplify from '@aws-amplify/core';
import Auth from "@aws-amplify/auth";
import { Logger } from 'aws-amplify';
import adminRoutes from "adminRoutes.js";
import managerRoutes from "managerRoutes.js";
import associateRoutes from "associateRoutes.js";
import emptyRoutes from "emptyRoutes.js";
import engineerRoutes from "engineerRoutes.js"
import AdminNavbar from "components/Navbars/AdminNavbar";
import Footer from "components/Footer/Footer";
import Sidebar from "components/Sidebar/Sidebar";
import { style } from "variables/Variables.jsx";
import Home from "views/Home.jsx";
import AWS from 'aws-sdk';
import configurations from 'variables/configurations'
declare var andon_config;
Amplify.configure(andon_config);
const logger = new Logger(configurations.logger.name, configurations.logger.level);

class Admin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      notificationSystem: null,
      color: "black",
      fixedClasses: "dropdown show-dropdown open",
      routes: []
    };
    this.roleBaseAccess = this.roleBaseAccess.bind(this);
    this.NoMatch = ({ location }) => (
      <div>
        <h3><center>No match for <code>{location.pathname}</code></center></h3>
      </div>
    )
  }

  // Handles Notification
  handleNotification = (message, level, iconClassName, autoDismissSecond) => {
    this.state.notificationSystem.addNotification({
      title: (<span data-notify="icon" className={iconClassName}></span>),
      message: (
        <div>{message}</div>
      ),
      level: level,
      position: 'tr',
      autoDismiss: autoDismissSecond,
    });
  };

  // Gets API token
  getToken = async () => {
    let user = await Auth.currentAuthenticatedUser({ bypassCache: true });
    let token = user.signInUserSession.idToken.jwtToken;

    return token;
  };

  // Checks scroll
  isScrollBottom = () => {
    let scrollTop = document.scrollingElement.scrollTop;
    let offsetHeight = document.documentElement.offsetHeight;
    let innerHeight = window.innerHeight;

    return innerHeight + scrollTop === offsetHeight;
  };

  // Goes to the top of the page
  goTop = () => {
    document.scrollingElement.scrollTop = 0;
  };

  handleDateSize = (date) => {
    return date.substring(0, 10);
  };

  // Get user IAM group
  roleBaseAccess = async () => {
    let grps = []
    const u = await Auth.currentAuthenticatedUser()
    grps = u.signInUserSession.accessToken.payload['cognito:groups']
    logger.debug(`user groups: ${JSON.stringify(grps, null, 2)}`)
    if (!grps) {
      this.setState({ routes: emptyRoutes })
    }
    else if (grps.includes('AdminGroup')) {
      this.setState({ routes: adminRoutes })
    }
    else if (grps.includes('ManagerGroup')) {
      this.setState({ routes: managerRoutes })
    }
    else if (grps.includes('EngineerGroup')) {
      this.setState({ routes: engineerRoutes })
    }
    else if (grps.includes('AssociateGroup')) {
      this.setState({ routes: associateRoutes })
    }

    let cognitoIdentityId
    const _creds = await Auth.currentCredentials()
    AWS.config.update({
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(_creds)
    })
    const _info = await Auth.currentCredentials()
    cognitoIdentityId = _info.data.IdentityId;
    var params = {
      policyName: andon_config.aws_iot_policy_name,
      principal: cognitoIdentityId
    }
    try {
      await new AWS.Iot().attachPrincipalPolicy(params).promise()
    }
    catch (e) {
      console.log(e)
    }
  }

  getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.layout === "/admin") {
        return (
          <Route
            path={prop.path}
            render={props => (
              <prop.component
                {...props}
                handleNotification={this.handleNotification}
                getToken={this.getToken}
                isScrollBottom={this.isScrollBottom}
                goTop={this.goTop}
                handleDateSize={this.handleDateSize}
              />
            )}
            exact
            key={key}
          />
        );
      } else {
        return null;
      }
    });
  };
  async componentDidMount() {
    this.setState({ notificationSystem: this.refs.notificationSystem });
    await this.roleBaseAccess()
  }

  componentDidUpdate(e) {
    var toggleState = false
    if (
      window.innerWidth < 1991 &&
      e.history.location.pathname !== e.location.pathname &&
      document.documentElement.className.indexOf("nav-open") !== -1 && !toggleState
    ) {
      document.documentElement.classList.toggle("nav-open");
      toggleState = true;
    }
    if (e.history.action === "PUSH") {
      document.documentElement.scrollTop = 0;
      document.scrollingElement.scrollTop = 0;
      this.refs.mainPanel.scrollTop = 0;
    }
  }

  render() {
    return (
      <div className="wrapper">
        <NotificationSystem ref="notificationSystem" style={style} />
        <Sidebar {...this.props} routes={this.state.routes} color={this.state.color} />
        <div id="main-panel" className="main-panel" ref="mainPanel">
          <AdminNavbar
            {...this.props}
            handleNotification={this.handleNotification}
            getToken={this.getToken}
          />
          <Switch>
            <Route path="/" exact component={Home} />
            {this.getRoutes(this.state.routes)}
            <Route component={this.NoMatch} />
          </Switch>
          <Footer />
        </div>
      </div >
    );
  }
}

export default withAuthenticator(Admin);
