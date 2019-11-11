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
import { createArea } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from "./sendMetrics";

import configurations from 'variables/configurations'

const logger = new Logger(configurations.logger.name, configurations.logger.level);
class AreaRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);

    this.handleAreaNameChange = this.handleAreaNameChange.bind(this);
    this.handleAreaDescriptionChange = this.handleAreaDescriptionChange.bind(this);

    this.state = {
      step: 0,
      areaName: '',
      areaDescription: '',
      siteId: '',
      areaId: '',
      areas: [],
      isLoading: false,
      error: false,
      areaNameValidateState: null,
      showAreaNameHelpBlock: false,
      areaDescriptionValidateState: null,
      areaDescriptionHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the area is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    this.setState({ siteId: this.props.match.params })
    if (state) {
      this.setState({
        step: 1,
      });
    }
  }

  goBack() {
    const { siteId } = this.props.match.params
    this.props.history.push(`/sites/${siteId}/areas`);
  }

  // Handles input changes
  handleAreaNameChange = (event) => {
    this.setState({ areaName: event.target.value }, () => {
      this.validateInput('areaName');
    });
  }

  handleAreaDescriptionChange = (event) => {
    this.setState({ areaDescription: event.target.value }, () => {
      this.validateInput('areaDescription');
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9- _/#]{4,40}$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'areaName': {
        input = this.state.areaName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showAreaNameHelpBlock: false,
            areaNameValidateState: null,
          });
        } else {
          this.setState({
            showAreaNameHelpBlock: true,
            areaNameValidateState: 'error',
          });
        }
        break;
      }

      case 'areaDescription': {
        input = this.state.areaDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showAreaDescriptionHelpBlock: false,
            areaDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showAreaDescriptionHelpBlock: true,
            areaDescriptionValidateState: 'error',
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

  // Registers area
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isAreaNameValidated = this.validateInput('areaName');
      let isAreaDescriptionValidated = this.validateInput('areaDescription')

      if (!isAreaNameValidated || !isAreaDescriptionValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });


        try {
          // Graphql operation to register area
          const { siteId } = this.state.siteId
          let input = {
            name: this.state.areaName,
            areaSiteId: siteId,
            description: this.state.areaDescription
          }

          const response = await API.graphql(graphqlOperation(createArea, { input }))
          this.setState({
            step: 1,
            areaId: response.data.createArea.id
          })
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'area': 1 })
          this.goBack()
        } catch (error) {
          let { errorType, message } = error.errors[0]
          logger.error(`errorType: ${errorType}, message: ${message}`)
          if (message === undefined) {
            message = 'undefined';
          } else {
            if (errorType === 'Unauthorized') message = 'Not authorized to create area, please contact your Admin';
          }
          this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        }
      }
    } else {
      this.props.handleNotification('Area is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  render() {
    const { isLoading, error,
      areaNameValidateState, showAreaNameHelpBlock, areaDescriptionValidateState, showAreaDescriptionHelpBlock
    } = this.state;

    if (this.state.step === 1) { return null }
    else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Area Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formAreaName" validationState={areaNameValidateState}>
                          <ControlLabel>Area Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the area name" defaultValue="" onChange={this.handleAreaNameChange} />
                          {showAreaNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formAreaDescription" validationState={areaDescriptionValidateState}>
                          <ControlLabel>Area Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the area description" defaultValue="" onChange={this.handleAreaDescriptionChange} />
                          {showAreaDescriptionHelpBlock &&
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

export default AreaRegistration;
