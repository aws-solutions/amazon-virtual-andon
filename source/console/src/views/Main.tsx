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

 // Import React and Amplify packages
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { LinkContainer } from 'react-router-bootstrap';
import { GoSignOut } from 'react-icons/go';
import { I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';

// Import React Bootstrap components
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Button from 'react-bootstrap/Button';

// Import custom setting
import { LOGGING_LEVEL } from '../util/CustomUtil';
import { IRoute } from '../components/Interfaces';
import NoMatch from '../components/NoMatch';
import EmptyCol from '../components/EmptyCol';

// Import views
import Home from './Home';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  authState?: any;
  routes: IRoute[];
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {}

// Logging
const LOGGER = new Logger('Main', LOGGING_LEVEL);

/**
 * The main application including Amplify authentication and routers per user group
 * @class Main
 */
class Main extends React.Component<IProps, IState> {
  constructor(props: Readonly<IProps>) {
    super(props);

    this.signOut = this.signOut.bind(this);
  }

  /**
   * Sign out the user.
   */
  signOut() {
    Auth.signOut().catch((error) => {
      LOGGER.error('Error occurred while signing out.', error);
    });
  }

  /**
   * Render this page.
   */
  render() {
    if (this.props.authState === 'signedIn') {
      return (
        <div className="main-wrapper">
          <Router>
            <Navbar bg="light" expand="xl">
              <Navbar.Brand href="/">
                Amazon Virtual Andon
              </Navbar.Brand>
              <Navbar.Toggle />
              <Navbar.Collapse className="justify-content-end">
                <Nav>
                  {
                    this.props.routes
                      .filter((route: IRoute) => route.visible)
                      .map((route: IRoute) => {
                      return (
                        <LinkContainer to={route.path} key={route.path}>
                          <Nav.Link>
                            {
                              route.icon &&
                              <route.icon />
                            }
                            <EmptyCol />
                            { I18n.get(route.nameCode) }
                          </Nav.Link>
                        </LinkContainer>
                      );
                    })
                  }
                </Nav>
                <Button variant="link" onClick={ this.signOut }>
                  <GoSignOut />
                  <EmptyCol />
                  { I18n.get('button.sign.out') }
                </Button>
              </Navbar.Collapse>
            </Navbar>
            <Switch>
              <Route exact path="/" render={(props) => (<Home {...props} />)} />
              {
                this.props.routes.map((route: IRoute) => {
                  return (
                    <Route key={route.path} exact path={route.path} render={(props) => (<route.component {...props} handleNotification={this.props.handleNotification} />)} />
                  );
                })
              }
              <Route render={(props) => (<NoMatch {...props} />)} />
            </Switch>
          </Router>
        </div>
      );
    } else {
      return null;
    }
  }
}

export default Main;