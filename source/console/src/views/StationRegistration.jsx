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
import { createStation } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from "./sendMetrics";
import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);

class StationRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);

    this.handleStationNameChange = this.handleStationNameChange.bind(this);
    this.handleStationDescriptionChange = this.handleStationDescriptionChange.bind(this);

    this.state = {
      step: 0,
      stationName: '',
      stationDescription: '',
      areaId: '',
      stationId: '',
      stations: [],
      isLoading: false,
      error: false,
      stationNameValidateState: null,
      showStationNameHelpBlock: false,
      stationDescriptionValidateState: null,
      stationDescriptionHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the station is pending to be registered, and a user wants to see the registration instruction again.
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
    this.props.history.push(`/areas/${areaId}/stations`);
  }

  // Handles input changes
  handleStationNameChange = (event) => {
    this.setState({ stationName: event.target.value }, () => {
      this.validateInput('stationName');
    });
  }

  handleStationDescriptionChange = (event) => {
    this.setState({ stationDescription: event.target.value }, () => {
      this.validateInput('stationDescription');
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9-_ /]{4,40}$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'stationName': {
        input = this.state.stationName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showStationNameHelpBlock: false,
            stationNameValidateState: null,
          });
        } else {
          this.setState({
            showStationNameHelpBlock: true,
            stationNameValidateState: 'error',
          });
        }
        break;
      }

      case 'stationDescription': {
        input = this.state.stationDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showStationDescriptionHelpBlock: false,
            stationDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showStationDescriptionHelpBlock: true,
            stationDescriptionValidateState: 'error',
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

  // Registers station
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isStationNameValidated = this.validateInput('stationName');
      let isStationDescriptionValidated = this.validateInput('stationDescription')

      if (!isStationNameValidated || !isStationDescriptionValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });


        try {
          // Graphql operation to register station
          const { areaId } = this.state.areaId
          let input = {
            name: this.state.stationName,
            stationAreaId: areaId,
            description: this.state.stationDescription
          }

          const response = await API.graphql(graphqlOperation(createStation, { input }))
          this.setState({
            step: 1,
            stationId: response.data.createStation.id
          })
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'station': 1 })
          this.goBack()
        } catch (error) {
          let { errorType, message } = error.errors[0]
          logger.error(errorType, message)
          if (message === undefined) {
            message = 'undefined';
          } else {
            if (errorType === 'Unauthorized') message = 'Not authorized to create station, please contact your Admin';
          }
          this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        }
      }
    } else {
      this.props.handleNotification('Station is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  render() {
    const { isLoading, error,
      stationNameValidateState, showStationNameHelpBlock, stationDescriptionValidateState, showStationDescriptionHelpBlock
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
                  title="Station Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formStationName" validationState={stationNameValidateState}>
                          <ControlLabel>Station Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the station name" defaultValue="" onChange={this.handleStationNameChange} />
                          {showStationNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formStationDescription" validationState={stationDescriptionValidateState}>
                          <ControlLabel>Station Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the station description" defaultValue="" onChange={this.handleStationDescriptionChange} />
                          {showStationDescriptionHelpBlock &&
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

export default StationRegistration;
