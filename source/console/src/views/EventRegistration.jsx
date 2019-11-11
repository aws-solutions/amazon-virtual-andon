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
import Auth from "@aws-amplify/auth";
import isEmail from 'validator/lib/isEmail';
//import AWS from "aws-sdk"
import SNS from 'aws-sdk/clients/sns';
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
import { createEvent } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';
import sendMetrics from './sendMetrics'

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);
declare var andon_config;
class EventRegistration extends Component {
  constructor(props) {
    super(props);

    this.goBack = this.goBack.bind(this);
    this.register = this.register.bind(this);

    this.handleEventNameChange = this.handleEventNameChange.bind(this);
    this.handleEventDescriptionChange = this.handleEventDescriptionChange.bind(this);
    this.handleEventSMSChange = this.handleEventSMSChange.bind(this);
    this.handleEventEmailChange = this.handleEventEmailChange.bind(this);
    this.handleEventPriorityChange = this.handleEventPriorityChange.bind(this);
    this.handleEventTypeChange = this.handleEventTypeChange.bind(this);

    this.state = {
      step: 0,
      eventName: '',
      eventDescription: '',
      eventSms: '',
      eventEmail: '',
      eventPriority: '',
      eventType: '',
      siteId: '',
      eventId: '',
      events: [],
      isLoading: false,
      error: false,
      eventNameValidateState: null,
      eventSmsValidateState: null,
      eventPhoneValidateState: null,
      eventPriorityValidateState: null,
      eventDescriptionValidateState: null,
      showEventDescriptionHelpBlock: false,
      eventTypeValidateState: null,
      showEventTypeHelpBlock: false,
      showEventSmsHelpBlock: false,
      showEventEmailHelpBlock: false,
      showEventNameHelpBlock: false,
      showEventPriorityHelpBlock: false,
      isRegistering: false,
    };
  };

  componentDidMount() {
    // Checks if the previous page sends a state.
    // It would only happens when the event is pending to be registered, and a user wants to see the registration instruction again.
    const state = this.props.location.state;
    this.setState({ processId: this.props.match.params })
    if (state) {
      this.setState({
        step: 1,
      });
    }
  }

  goBack() {
    const { processId } = this.props.match.params
    this.props.history.push(`/processes/${processId}/events`);
  }

  // Handles input changes
  handleEventNameChange = (event) => {
    this.setState({ eventName: event.target.value }, () => {
      this.validateInput('eventName');
    });
  }

  handleEventDescriptionChange = (event) => {
    this.setState({ eventDescription: event.target.value }, () => {
      this.validateInput('eventDescription')
    });
  }

  handleEventSMSChange = (event) => {
    this.setState({ eventSms: event.target.value }, () => {
      this.validateInput('eventSms')
    });
  }

  handleEventEmailChange = (event) => {
    this.setState({ eventEmail: event.target.value }, () => {
      this.validateInput('eventEmail')
    });
  }

  handleEventPriorityChange = (event) => {
    this.setState({ eventPriority: event.target.value }, () => {
      this.validateInput('eventPriority')
    });
  }

  handleEventTypeChange = (event) => {
    this.setState({ eventType: event.target.value }, () => {
      this.validateInput('eventType')
    });
  }

  // Validates inputs
  validateInput = (type) => {
    let regexp = /^([a-zA-Z0-9-_ /#]{4,40}|)$/;
    let regexpED = /^[a-zA-Z0-9-_ /#]{4,40}$/;
    let regexpNumber = /^(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
    let regexPriority = ['low', 'medium', 'high', 'critical'];
    let pass = false;
    let input = '';

    switch (type) {
      case 'eventName': {
        input = this.state.eventName;
        pass = regexp.test(input);

        if (pass) {
          this.setState({
            showEventNameHelpBlock: false,
            eventNameValidateState: null,
          });
        } else {
          this.setState({
            showEventNameHelpBlock: true,
            eventNameValidateState: 'error',
          });
        }
        break;
      }

      case 'eventSms': {
        input = this.state.eventSms;
        pass = regexpNumber.test(input);

        if (pass) {
          this.setState({
            showEventSmsHelpBlock: false,
            eventSmsValidateState: null,
          });
        } else {
          this.setState({
            showEventSmsHelpBlock: true,
            eventSmsValidateState: 'error',
          });
        }
        break;
      }

      case 'eventEmail': {
        input = this.state.eventEmail;
        pass = isEmail(input);

        if (pass) {
          this.setState({
            showEventEmailHelpBlock: false,
            eventEmailValidateState: null,
          });
        } else {
          this.setState({
            showEventEmailHelpBlock: true,
            eventEmailValidateState: 'error',
          });
        }
        break;
      }

      case 'eventType': {
        input = this.state.eventType;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showEventTypeHelpBlock: false,
            eventTypeValidateState: null,
          });
        } else {
          this.setState({
            showEventTypeHelpBlock: true,
            eventTypeValidateState: 'error',
          });
        }
        break;
      }

      case 'eventDescription': {
        input = this.state.eventDescription;
        pass = regexpED.test(input);

        if (pass) {
          this.setState({
            showEventDescriptionHelpBlock: false,
            eventDescriptionValidateState: null,
          });
        } else {
          this.setState({
            showEventDescriptionHelpBlock: true,
            eventDescriptionValidateState: 'error',
          });
        }
        break;
      }

      case 'eventPriority': {
        input = this.state.eventPriority;
        pass = regexPriority.includes(input)

        if (pass) {
          this.setState({
            showEventPriorityHelpBlock: false,
            eventPriorityValidateState: null,
          });
        } else {
          this.setState({
            showEventPriorityHelpBlock: true,
            eventPriorityValidateState: 'error',
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

  createSNS = async (topicName) => {
    const _creds = await Auth.currentCredentials()
    const sns = new SNS({
      apiVersion: '2010-03-31',
      region: andon_config.aws_project_region,
      credentials: Auth.essentialCredentials(_creds)
    });
    try {
      const response = await sns.createTopic({ Name: `andon-${topicName}` }).promise()
      try { await sns.subscribe({ Protocol: 'email', TopicArn: response.TopicArn, Endpoint: this.state.eventEmail }).promise() } catch (e) { this.props.handleNotification('email notification not set', 'warning', 'pe-7s-check', 5); logger.info(e.message) }
      try { await sns.subscribe({ Protocol: 'sms', TopicArn: response.TopicArn, Endpoint: this.state.eventSms }).promise() } catch (e) { this.props.handleNotification('sms notification not set', 'warning', 'pe-7s-check', 5); logger.info(e.message) }
    }
    catch (error) {
      throw new Error(error.message)
    }
  }

  // Registers event
  register = async () => {
    this.setState({ error: false, });

    if (!this.state.isRegistering) {
      this.setState({ isRegistering: true });
      let isEventNameValidated = this.validateInput('eventName');
      let isEventSmsValidated = (!this.state.eventSms) ? true : this.validateInput('eventSms');
      let isEventEmailValidated = (!this.state.eventEmail) ? true : this.validateInput('eventEmail');
      let isEventPriorityValidated = this.validateInput('eventPriority');
      let isEventDescriptionValidated = this.validateInput('eventDescription');
      let isEventTypeValidated = (!this.state.eventType) ? true : this.validateInput('eventType');

      if (!isEventNameValidated || !isEventSmsValidated || !isEventEmailValidated || !isEventPriorityValidated || !isEventDescriptionValidated || !isEventTypeValidated) {
        this.props.handleNotification('Check input variables', 'error', 'pe-7s-check', 5);
        this.setState({ isRegistering: false });
      } else {
        this.setState({ isLoading: true });
        try {
          // Graphql operation to register event
          const { processId } = this.state.processId
          let input = {
            name: this.state.eventName,
            eventProcessId: processId,
            description: this.state.eventDescription,
            sms: this.state.eventSms,
            email: this.state.eventEmail,
            priority: this.state.eventPriority,
            type: this.state.eventType
          }
          for (let propName in input) {
            if (input[propName] === '' || input[propName] === undefined) {
              delete input[propName];
            }
          }
          logger.debug(input)
          const response = await API.graphql(graphqlOperation(createEvent, { input }))
          await this.createSNS(this.state.eventName.replace(/\s+/g, '-'))
          this.setState({
            step: 1,
            eventId: response.data.createEvent.id
          })
          this.setState({
            isLoading: false,
            isRegistering: false,
          });
          await sendMetrics({ 'event': 1 })
          this.goBack()
        } catch (error) {
          if (error.errors) {
            let { errorType, message } = error.errors[0]
            if (message === undefined) {
              message = 'undefined error';
            } else if (errorType === 'Unauthorized') {
              message = 'Not authorized to create event, please contact your Admin';
            }
            else if (errorType === 'DynamoDB:AmazonDynamoDBException') {
              logger.debug(message)
              message = "Event could not be created"
            }
            this.props.handleNotification(message, 'error', 'pe-7s-check', 5)
            this.setState({
              isLoading: false,
              isRegistering: false,
            });
          }
          else {
            logger.error(error)
            let message = 'Event created without subscription topic'
            this.props.handleNotification(message, 'warning', 'pe-7s-check', 5)
            this.setState({
              isLoading: false,
              isRegistering: false,
            });
            this.goBack()
          }

        }
      }
    } else {
      this.props.handleNotification('Event is still registering', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  render() {
    const {
      isLoading, error,
      eventNameValidateState, showEventNameHelpBlock, eventSmsValidateState, showEventSmsHelpBlock, eventEmailValidateState, showEventEmailHelpBlock, eventPriorityValidateState, showEventPriorityHelpBlock, eventDescriptionValidateState, showEventDescriptionHelpBlock, eventTypeValidateState, showEventTypeHelpBlock
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
                  title="Event Registration"
                  content={
                    <div>
                      <Col md={6}>
                        <FormGroup controlId="formEventName" validationState={eventNameValidateState}>
                          <ControlLabel>Event Name</ControlLabel>
                          <FormControl type="text" placeholder="Enter the event name" defaultValue="" onChange={this.handleEventNameChange} />
                          {showEventNameHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: -_/space with max length of 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formEventDescription" validationState={eventDescriptionValidateState}>
                          <ControlLabel>Event Description</ControlLabel>
                          <FormControl type="text" placeholder="Enter the event description" defaultValue="" onChange={this.handleEventDescriptionChange} />
                          {showEventDescriptionHelpBlock &&
                            <HelpBlock>Must contain only alphanumeric characters and/or the following: -_/space with max length of 40</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formSMSGroupNo." validationState={eventSmsValidateState}>
                          <ControlLabel>SMS No #</ControlLabel>
                          <FormControl type="text" placeholder="Enter sms number, eg: +44 4444444444" defaultValue="" onChange={this.handleEventSMSChange} />
                          {showEventSmsHelpBlock &&
                            <HelpBlock>Must be a valid phone number, leave blank if sms notification not required</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formEmailGroupId" validationState={eventEmailValidateState}>
                          <ControlLabel>Email Id # </ControlLabel>
                          <FormControl type="text" placeholder="Enter the group email id" defaultValue="" onChange={this.handleEventEmailChange} />
                          {showEventEmailHelpBlock &&
                            <HelpBlock>Must be a valid email address, leave blank if email notification not required</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formEventPriority" validationState={eventPriorityValidateState}>
                          <ControlLabel>Event Priority</ControlLabel>
                          <FormControl type="text" placeholder="Enter the event priority" defaultValue="" onChange={this.handleEventPriorityChange} />
                          {showEventPriorityHelpBlock &&
                            <HelpBlock>Must be low, medium, high or critical</HelpBlock>
                          }
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup controlId="formEventType" validationState={eventTypeValidateState}>
                          <ControlLabel>Event Type</ControlLabel>
                          <FormControl type="text" placeholder="Enter the event type" defaultValue="" onChange={this.handleEventTypeChange} />
                          {showEventTypeHelpBlock &&
                            <HelpBlock>Leave blank or must contain only alphanumeric characters and/or the following: -_/space with max length of 40</HelpBlock>
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

export default EventRegistration;
