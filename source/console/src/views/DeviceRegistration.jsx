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
import { API, graphqlOperation } from "aws-amplify";
import {
  Grid,
  Row,
  Col,
  Button,
  ProgressBar,
  Alert,
  FormGroup,
  ControlLabel,
  FormControl,
  HelpBlock
} from "react-bootstrap";
import { createDevice } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from './sendMetrics'

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);

class DeviceRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);

    this.handleDeviceNameChange = this.handleDeviceNameChange.bind(this);
    this.handleDeviceDescriptionChange = this.handleDeviceDescriptionChange.bind(this);

    this.state = {
      step: 0,
      deviceName: '',
      deviceDescription: '',
      siteId: '',
      deviceId: '',
      devices: [],
      isLoading: false,
      error: false,
      deviceNameValidateState: null,
      showDeviceNameHelpBlock: false,
      stationDescriptionValidateState: null,
      stationDescriptionHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the device is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    this.setState({ stationId: this.props.match.params })
    if (state) {
      this.setState({
        step: 1,
      });
    }
  }

  goBack() {
    const { stationId } = this.props.match.params
    this.props.history.push(`/stations/${stationId}/devices`);
  }

  // Handles input changes
  handleDeviceNameChange = (event) => {
    this.setState({ deviceName: event.target.value }, () => {
      this.validateInput('deviceName');
    });
  }

  handleDeviceDescriptionChange = (event) => {
    this.setState({ deviceDescription: event.target.value }, () => {
      this.validateInput('deviceDescription');
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9- _/#]{4,40}$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'deviceName': {
        input = this.state.deviceName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showDeviceNameHelpBlock: false,
            deviceNameValidateState: null,
          });
        } else {
          this.setState({
            showDeviceNameHelpBlock: true,
            deviceNameValidateState: 'error',
          });
        }
        break;
      }

      case 'deviceDescription': {
        input = this.state.deviceDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showDeviceDescriptionHelpBlock: false,
            deviceDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showDeviceDescriptionHelpBlock: true,
            deviceDescriptionValidateState: 'error',
          });
        }
        break;
      }

      default: {
        // do nothing
        break;
      }
    }

    return pass;
  }

  // Registers device
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isDeviceNameValidated = this.validateInput('deviceName');
      let isDeviceDescriptionValidated = this.validateInput('deviceDescription')

      if (!isDeviceNameValidated || !isDeviceDescriptionValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });


        try {
          // Graphql operation to register device
          const { stationId } = this.state.stationId
          let input = {
            name: this.state.deviceName,
            deviceStationId: stationId,
            description: this.state.deviceDescription
          }

          const response = await API.graphql(graphqlOperation(createDevice, { input }))
          this.setState({
            step: 1,
            deviceId: response.data.createDevice.id
          })
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'device': 1 })
          this.goBack()
        } catch (error) {
          let { errorType, message } = error.errors[0]
          logger.error(`errorType: ${errorType}, message: ${message}`)
          if (message === undefined) {
            message = 'undefined';
          } else {
            if (errorType === 'Unauthorized') message = 'Not authorized to create device, please contact your Admin';
          }
          this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        }
      }
    } else {
      this.props.handleNotification('Device is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  render() {
    const { isLoading, error,
      deviceNameValidateState, showDeviceNameHelpBlock, deviceDescriptionValidateState, showDeviceDescriptionHelpBlock
    } = this.state;

    if (this.state.step === 1) {
      return null
    } else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Device Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formDeviceName" validationState={deviceNameValidateState}>
                          <ControlLabel>Device Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the device name" defaultValue="" onChange={this.handleDeviceNameChange} />
                          {showDeviceNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formDeviceDescription" validationState={deviceDescriptionValidateState}>
                          <ControlLabel>Device Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the device description" defaultValue="" onChange={this.handleDeviceDescriptionChange} />
                          {showDeviceDescriptionHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={12}>
                        <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.register}>Register</Button>
                        <Button className="btn-fill" bsSize="small" onClick={this.goBack}>Cancel</Button>
                      </Col>
                      <div className="clearfix" />
                    </div>
                  }
                />
              </Col>
            </Row>
            {isLoading &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <div>
                    <ProgressBar active now={50} />
                  </div>
                </Col>
              </Row>
            }
            {error &&
              <Row>
                <Col md={8} mdOffset={2}>
                  <Alert bsStyle="danger">
                    <span>{this.state.error}</span>
                  </Alert>
                </Col>
              </Row>
            }
          </Grid>
        </div>
      );
    }
  }
}

export default DeviceRegistration;
