// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React and Amplify packages
import React from 'react';
import { I18n } from 'aws-amplify';
import { ForgotPassword } from 'aws-amplify-react';

// Import React Bootstrap components
import Navbar from 'react-bootstrap/Navbar';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';

/**
 * Customized Amplify forgot password
 * @class CustomForgotPassword
 */
class CustomForgotPassword extends ForgotPassword {
  private code: string;
  private password: string;
  private confirmPassword: string;
  private username: string;

  constructor(props: any) {
    super(props);
    this._validAuthStates = ['forgotPassword'];
    this.state = { delivery: null };

    this.code = '';
    this.password = '';
    this.confirmPassword = '';
    this.username = '';

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.checkCode = this.checkCode.bind(this);
    this.checkPassword = this.checkPassword.bind(this);
    this.checkUsername = this.checkUsername.bind(this);
    this.passwordChangeView = this.passwordChangeView.bind(this);
    this.usernameView = this.usernameView.bind(this);
  }

  /**
   * Handle the key down event
   * @param event {any} - Key down event
   * @param type {string} - Key down event type
   */
  handleKeyDown(event: any, type: string) {
    // If an enter key (key code 13) is down, handle the event.
    if (event.keyCode === 13) {
      event.preventDefault();
      if (type === 'username') {
        this.checkUsername();
      } else if (type === 'password') {
        this.checkCode();
      }
    }
  }

  /**
   * Check if the code is not empty.
   */
  checkCode() {
    if (this.code.trim() === '') {
      this.error(I18n.get('error.empty.confirmation.code'));
    } else {
      this.checkPassword();
    }
  }

  /**
   * Check if the password is not empty, and the password the confirm password is same.
   */
  checkPassword() {
    if (this.password.trim() === '') {
      this.error(I18n.get('error.empty.password'));
    } else if (this.password !== this.confirmPassword) {
      this.error(I18n.get('error.check.password.confirm.password'));
    } else {
      this.submit();
    }
  }

  /**
   * Check if the username is empty.
   */
  checkUsername() {
    if (this.username.trim() === '') {
      this.error(I18n.get('error.empty.username'));
    } else {
      this.send();
    }
  }

  /**
   * When a user name is provided, show this view.
   * @return {JSX.Element} Password change view
   */
  passwordChangeView(): JSX.Element {
    return (
      <div>
        <Form.Group as={Row} controlId="formCode" key="formCode">
          <Form.Label column md={3}>
            { I18n.get('text.code') }
          </Form.Label>
          <Col md={9}>
            <Form.Control key="code" name="code" type="text" autoComplete="off" placeholder={ I18n.get('text.code') } onChange={(event: any) => { this.handleInputChange(event); this.code = event.target.value }} />
          </Col>
        </Form.Group>
        <Form.Group as={Row} controlId="formPassword" key="formPassword">
          <Form.Label column md={3}>
            { I18n.get('text.new.password') }
          </Form.Label>
          <Col md={9}>
            <Form.Control key="password" name="password" type="password" placeholder={ I18n.get('text.new.password') } onKeyDown={(event: any) => { this.handleKeyDown(event, 'password')}} onChange={(event: any) => { this.handleInputChange(event); this.password = event.target.value }} />
          </Col>
        </Form.Group>
        <Form.Group as={Row} controlId="formConfirmPassword" key="formConfirmPassword">
          <Form.Label column md={3}>
            { I18n.get('text.confirm.passwrod') }
          </Form.Label>
          <Col md={9}>
            <Form.Control key="confirmPassword" name="confirmPassword" type="password" placeholder={ I18n.get('text.confirm.passwrod') } onKeyDown={(event: any) => { this.handleKeyDown(event, 'password') }} onChange={(event: any) => { this.confirmPassword = event.target.value }} />
          </Col>
        </Form.Group>
        <Form.Group as={Row} className="justify-content-between" key="sendButtonGroup">
          <Button key="buttonResendCode" variant="link" onClick={this.send}>{ I18n.get('button.resend.code') }</Button>
          <Button key="buttonSubmit" variant="primary" onClick={this.checkCode}>{ I18n.get('button.submit') }</Button>
        </Form.Group>
      </div>
    );
  }

  /**
   * Show this view initially.
   * @return {JSX.Element} User name view
   */
  usernameView(): JSX.Element {
    return (
      <div>
        <Form.Group as={Row} controlId="formUsername" key="formUsername">
          <Form.Label column md={3}>
            { I18n.get('text.email') }
          </Form.Label>
          <Col md={9}>
            <Form.Control key="username" name="username" type="text" placeholder={ I18n.get('input.email') } onKeyDown={(event: any) => { this.handleKeyDown(event, 'username') }} onChange={(event: any) => { this.handleInputChange(event); this.username = event.target.value }} />
          </Col>
        </Form.Group>
        <Form.Group as={Row} className="justify-content-between" key="initialButtonGroup">
          <Button key="buttonBackToSignIn" variant="link" onClick={() => this.changeState('signIn')}>{ I18n.get('text.back.to.sign.in') }</Button>
          <Button key="buttonSend" variant="primary" onClick={this.checkUsername}>{ I18n.get('button.send') }</Button>
        </Form.Group>
      </div>
    );
  }

  /**
   * Show customized component
   */
  showComponent() {
    const { authData={} } = this.props;
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
              <h4>{ I18n.get('text.reset.password') }</h4>
            </Col>
          </Row>
          <Row className="justify-content-md-center">
            <Col lg={6} md={8} xs={12}>
              <Form>
                {
                  this.state.delivery || authData.username ? this.passwordChangeView() : this.usernameView()
                }
              </Form>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default CustomForgotPassword;