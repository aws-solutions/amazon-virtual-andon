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
import * as React from 'react';
import { VerifyContact } from 'aws-amplify-react';

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
 * Customized Amplify verify contact
 * @class CustomVerifyContact
 */
class CustomVerifyContact extends VerifyContact {
  private isEmailChecked: boolean;
  private code: string;

  constructor(props: any) {
    super(props);
    this._validAuthStates = ['verifyContact'];
    this.state = { verifyAttr: null };

    this.isEmailChecked = false;
    this.code = '';

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.checkRadio = this.checkRadio.bind(this);
    this.checkCode = this.checkCode.bind(this);
    this.verifyView = this.verifyView.bind(this);
    this.codeView = this.codeView.bind(this);
  }

  /**
   * Handle the key down event
   * @param event {any} - Key down event
   */
  handleKeyDown(event: any) {
    // If an enter key (key code 13) is down, call the submit function.
    if (event.keyCode === 13) {
      event.preventDefault();
      this.checkCode();
    }
  }

  /**
   * Check if the radio is selected.
   */
  checkRadio() {
    if (!this.isEmailChecked) {
      this.error(getLocaleString('E-Mail not selected.'));
    } else {
      this.verify();
    }
  }

  /**
   * Check if the code is not empty.
   */
  checkCode() {
    if (this.code.trim() === '') {
      this.error(getLocaleString('Confirmation code cannot be empty.'));
    } else {
      this.submit();
    }
  }

  /**
   * When the user's contact information is not verified, show this view.
   * @return {JSX.Element | null} Verify contact view
   */
  verifyView(): JSX.Element | null {
    return (
      <Form.Group as={Row} controlId="formUnverifed" key="formUnverifed" className="justify-content-md-center">
        <Col md={6}>
          <Form.Check type="radio" name="contact" value="email" label={ getLocaleString('E-Mail') } onChange={(event: any) => { this.handleInputChange(event); this.isEmailChecked = true }} />
        </Col>
      </Form.Group>
    );
  }

  /**
   * When the user selects verify method, show this view.
   * @return {JSX.Element} Code view
   */
  codeView(): JSX.Element {
    return (
      <Form.Group as={Row} controlId="formCode" key="formCode">
        <Form.Label column md={3}>
          { getLocaleString('Code') }
        </Form.Label>
        <Col md={9}>
          <Form.Control key="code" name="code" type="text" autoComplete="off" placeholder={ getLocaleString('Code') } onKeyDown={this.handleKeyDown} onChange={(event: any) => { this.handleInputChange(event); this.code = event.target.value }} />
        </Col>
      </Form.Group>
    );
  }

  /**
   * Show customized component
   */
  showComponent() {
    const { authData } = this.props;
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
              <h4>{ getLocaleString('Account recovery requires verified contact information') }</h4>
            </Col>
          </Row>
          <Row className="justify-content-md-center">
            <Col lg={6} md={8} xs={12}>
              <Form>
                {
                  this.state.verifyAttr ? this.codeView() : this.verifyView()
                }
                <Form.Group as={Row} className="justify-content-between">
                  <Button key="buttonSkip" onClick={() => this.changeState('signedIn', authData)}>{ getLocaleString('Skip') }</Button>
                  {
                    this.state.verifyAttr ?
                    <Button key="buttonSubmit" variant="primary" onClick={this.checkCode}>{ getLocaleString('Submit') }</Button> :
                    <Button key="buttonVerify" variant="primary" onClick={this.checkRadio}>{ getLocaleString('Send') }</Button>
                  }
                </Form.Group>
              </Form>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default CustomVerifyContact;