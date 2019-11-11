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
import { createSite } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from "./sendMetrics";

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);

class SiteRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);
    this.finish = this.finish.bind(this);

    this.handleSiteNameChange = this.handleSiteNameChange.bind(this);
    this.handleSiteDescriptionChange = this.handleSiteDescriptionChange.bind(this);

    this.state = {
      step: 0,
      siteName: '',
      siteDescription: '',
      siteId: '',
      isLoading: false,
      error: false,
      siteNameValidateState: null,
      showSiteNameHelpBlock: false,
      siteDescriptionValidateState: null,
      showSiteDescriptionHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the site is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    if (state) {
      this.setState({
        step: 1,
      });
    }
  }

  goBack() {
    this.props.history.push('/sites');
  }

  // Handles input changes
  handleSiteNameChange = (event) => {
    this.setState({ siteName: event.target.value }, () => {
      this.validateInput('siteName');
    });
  }

  handleSiteDescriptionChange = (event) => {
    this.setState({ siteDescription: event.target.value }, () => {
      this.validateInput('siteDescription');
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^[a-zA-Z0-9- _/#]{4,40}$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let pass = false;
    let input = '';

    switch (type) {
      case 'siteName': {
        input = this.state.siteName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showSiteNameHelpBlock: false,
            siteNameValidateState: null,
          });
        } else {
          this.setState({
            showSiteNameHelpBlock: true,
            siteNameValidateState: 'error',
          });
        }
        break;
      }

      case 'siteDescription': {
        input = this.state.siteDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showSiteDescriptionHelpBlock: false,
            siteDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showSiteDescriptionHelpBlock: true,
            siteDescriptionValidateState: 'error',
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

  // Registers site
  register = async () => {
    this.setState({ error: false, });
    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isSiteNameValidated = this.validateInput('siteName');
      let isSiteDescriptionValidated = this.validateInput('siteDescription')
      if (!isSiteNameValidated || !isSiteDescriptionValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);

        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });

        // Graphql operation to register site
        const input = {
          name: this.state.siteName,
          description: this.state.siteDescription
        }
        try {
          const response = await API.graphql(graphqlOperation(createSite, { input }))

          this.setState({
            step: 1,
            siteId: response.data.createSite.id
          });
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'site': 1 })
          this.finish()
        }
        catch (error) {
          let { errorType, message } = error.errors[0]
          logger.error(`errorType: ${errorType}, message:${message}`)
          if (message === undefined) {
            message = 'undefined';
          } else {
            if (errorType === 'Unauthorized') message = 'Not authorized to create site, please contact your Admin';
          }
          this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
        }
      }
    } else {
      this.props.handleNotification('Site is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  finish = () => {
    this.props.history.push(`/sites`);
  }

  render() {
    const { isLoading, error,
      siteNameValidateState, showSiteNameHelpBlock, siteDescriptionValidateState, showSiteDescriptionHelpBlock
    } = this.state;

    if (this.state.step === 1) { return null }
    else {
      return (
        <div className="content">
          <Grid fluid>
            <Row>
              <Col md={8} mdOffset={2}>
                <Card
                  title="Site Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formSiteName" validationState={siteNameValidateState}>
                          <ControlLabel>Site Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the site name" defaultValue="" onChange={this.handleSiteNameChange} />
                          {showSiteNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formSiteDescription" validationState={siteDescriptionValidateState}>
                          <ControlLabel>Site Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the site description" defaultValue="" onChange={this.handleSiteDescriptionChange} />
                          {showSiteDescriptionHelpBlock &&
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

export default SiteRegistration;
