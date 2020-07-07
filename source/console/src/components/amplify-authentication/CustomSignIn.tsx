/*********************************************************************************************************************
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
import { SignIn } from 'aws-amplify-react';

// Import React Bootstrap components
import Navbar from 'react-bootstrap/Navbar';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';

// Import custom setting
import { getLocaleString } from '../../util/CustomUtil';

/**
 * Customized Amplify sign in
 * @class CustomSignIn
 */
class CustomSignIn extends SignIn {
  private username: string;
  private password: string;

  constructor(props: any) {
    super(props);
    this._validAuthStates = ['signIn', 'signedOut', 'signedUp'];

    this.username = '';
    this.password = '';

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.checkUsername = this.checkUsername.bind(this);
    this.checkPassword = this.checkPassword.bind(this);
  }

  /**
   * Handle the key down event
   * @param event {any} - Key down event
   */
  handleKeyDown(event: any) {
    // If an enter key (key code 13) is down, call the signIn function.
    if (event.keyCode === 13) {
      event.preventDefault();
      this.checkUsername();
    }
  }

  /**
   * Check if the username is empty.
   */
  checkUsername() {
    if (this.username.trim() === '') {
      this.error(getLocaleString('Username cannot be empty.'));
    } else {
      this.checkPassword();
    }
  }

  /**
   * Check if the password is empty.
   */
  checkPassword() {
    if (this.password.trim() === '') {
      this.error(getLocaleString('Password cannot be empty.'));
    } else {
      this.signIn();
    }
  }

  /**
   * Show customized component
   */
  showComponent() {
    return (
      <div className="main-wrapper">
        <Navbar bg="light">
          <Navbar.Brand href="/">
            Amazon Virtual Andon
          </Navbar.Brand>
        </Navbar>
        <Container>
          <Row className="justify-content-md-center">
            <Col lg={6} md={8} xs={12}>
              <h4>{ getLocaleString('Sign in to your account') }</h4>
            </Col>
          </Row>
          <Row className="justify-content-md-center">
            <Col lg={6} md={8} xs={12}>
              <Form>
                <Form.Group as={Row} controlId="formUsername" key="formUsername">
                  <Form.Label column md={3}>
                    { getLocaleString('E-Mail') }
                  </Form.Label>
                  <Col md={9}>
                    <Form.Control key="username" name="username" type="text" placeholder={ getLocaleString('Enter your E-Mail') } onChange={(event: any) => { this.handleInputChange(event); this.username = event.target.value }} />
                  </Col>
                </Form.Group>
                <Form.Group as={Row} controlId="formPassword" key="formPassword">
                  <Form.Label column md={3}>
                    { getLocaleString('Password') }
                  </Form.Label>
                  <Col md={9}>
                    <Form.Control key="password" name="password" type="password" placeholder={ getLocaleString('Enter your password') } onKeyDown={this.handleKeyDown} onChange={(event: any) => { this.handleInputChange(event); this.password = event.target.value }} />
                  </Col>
                </Form.Group>
                <Form.Group as={Row} className="justify-content-between">
                  <div>
                  { getLocaleString('Forgot password') }? <Button variant="link" onClick={() => this.changeState('forgotPassword')}>{ getLocaleString('Reset password') }</Button>
                  </div>
                  <Button className="justify-content-end" variant="primary" onClick={this.checkUsername}>{ getLocaleString('Sign In') }</Button>
                </Form.Group>
              </Form>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default CustomSignIn;