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
import { createProcess } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from "./sendMetrics";

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);

class ProcessRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);

    this.handleProcessNameChange = this.handleProcessNameChange.bind(this);
    this.handleProcessDescriptionChange = this.handleProcessDescriptionChange.bind(this);

    this.state = {
      step: 0,
      processName: '',
      processDescription: '',
      siteId: '',
      processId: '',
      processes: [],
      isLoading: false,
      error: false,
      processNameValidateState: null,
      showProcessNameHelpBlock: false,
      processDescriptionValidateState: null,
      processDescriptionHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the process is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    this.setState({ areaId: this.props.match.params })
    if (state) {
      this.setState({
        step: 1,
      });
    }
  }

  goBack() {
    const { areaId } = this.props.match.params
    this.props.history.push(`/areas/${areaId}/processes`);
  }

  // Handles input changes
  handleProcessNameChange = (event) => {
    this.setState({ processName: event.target.value }, () => {
      this.validateInput('processName');
    });
  }

  handleProcessDescriptionChange = (event) => {
    this.setState({ processDescription: event.target.value }, () => {
      this.validateInput('processDescription');
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9- _/#]{4,40}$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'processName': {
        input = this.state.processName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showProcessNameHelpBlock: false,
            processNameValidateState: null,
          });
        } else {
          this.setState({
            showProcessNameHelpBlock: true,
            processNameValidateState: 'error',
          });
        }
        break;
      }

      case 'processDescription': {
        input = this.state.processDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showProcessDescriptionHelpBlock: false,
            processDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showProcessDescriptionHelpBlock: true,
            processDescriptionValidateState: 'error',
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

  // Registers process
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isProcessNameValidated = this.validateInput('processName');
      let isProcessDescriptionValidated = this.validateInput('processDescription')

      if (!isProcessNameValidated || !isProcessDescriptionValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });


        try {
          // Graphql operation to register process
          const { areaId } = this.state.areaId
          let input = {
            name: this.state.processName,
            processAreaId: areaId,
            description: this.state.processDescription
          }

          const response = await API.graphql(graphqlOperation(createProcess, { input }))
          this.setState({
            step: 1,
            processId: response.data.createProcess.id
          })
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'process': 1 })
          this.goBack()
        } catch (error) {
          let { errorType, message } = error.errors[0]
          logger.error(`errorType: ${errorType}, message:${message}`)
          if (message === undefined) {
            message = 'undefined';
          } else {
            if (errorType === 'Unauthorized') message = 'Not authorized to create process, please contact your Admin';
          }
          this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        }
      }
    } else {
      this.props.handleNotification('Process is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  render() {
    const { isLoading, error,
      processNameValidateState, showProcessNameHelpBlock, processDescriptionValidateState, showProcessDescriptionHelpBlock
    } = this.state;

    if (this.state.step === 1) { return null }
    else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Process Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formProcessName" validationState={processNameValidateState}>
                          <ControlLabel>Process Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the process name" defaultValue="" onChange={this.handleProcessNameChange} />
                          {showProcessNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formProcessDescription" validationState={processDescriptionValidateState}>
                          <ControlLabel>Process Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the process description" defaultValue="" onChange={this.handleProcessDescriptionChange} />
                          {showProcessDescriptionHelpBlock &&
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

export default ProcessRegistration;
