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
  Button,
  FormControl,
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  ProgressBar,
  Alert,
  Table,
  Modal,
  Label
} from 'react-bootstrap';

import { getProcess } from "graphql/queries";
import { deleteEvent } from "graphql/mutations";
import { Card } from "components/Card/Card.jsx";
import { Logger } from 'aws-amplify';

import configurations from 'variables/configurations'
const logger = new Logger(configurations.logger.name, configurations.logger.level);
const styles = {
  grid: {
    paddingLeft: 0,
    paddingRight: 0
  },
  row: {
    marginLeft: 0,
    marginRight: 0
  },
  col: {
    paddingLeft: 0,
    paddingRight: 0
  }
};
class Event extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterEvent = this.handleRegisterEvent.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      events: [],
      processName: '',
      error: false,
      isLoading: false,
      show: false,
      eventName: '',
      eventId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Events', });
    this.getProcess();
  }

  // Registers a Event
  handleRegisterEvent() {
    this.props.history.push(`/processes/${this.state.processId}/eventRegistration`);
  }

  // Handles to delete a event
  handleDelete = (eventId, eventName) => {
    this.setState({
      eventName: eventName,
      eventId: eventId,
      show: true,
    });
  }

  // Delets a event
  deleteEvent = async (eventId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: eventId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteEvent, { input }))
        this.props.handleNotification('Event was deleted successfully', 'success', 'pe-7s-close-circle', 5);
        let updatedEvent = this.state.events.filter(event => event.id !== eventId);
        this.setState({
          events: updatedEvent,
          title: `Events (${updatedEvent.length})`
        });
      }
      catch (error) {
        logger.error(error)
        this.props.handleNotification('Error occurred while deleting the event', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Event is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let events = this.state.events;

    for (let i = 0; i < events.length; i++) {
      let eventName = events[i].name;
      if (keyword === '') {
        // Empty keyword 
        events[i].visible = true;
      }
      else {
        // Some keyword 
        if (eventName.indexOf(keyword) > -1) {
          events[i].visible = true;
        } else {
          events[i].visible = false;
        }
      }
    }

    this.setState({ events: events });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortEvent(order);
  };

  // Sorts events
  sortEvent = (order) => {
    let events = this.state.events;
    if (order === 'asc') {
      events.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      events.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ events: events });
  };

  // Gets site events
  getProcess = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get events
      const { processId } = this.props.match.params;
      this.setState({ processId })
      const response = await API.graphql(graphqlOperation(getProcess, { id: processId }))
      let events = response.data.getProcess.event.items;
      let processName = response.data.getProcess.name;
      this.setState({ processName })

      // Adds visible key/value for filter
      for (let i = 0; i < events.length; i++) {
        events[i]['visible'] = true;
      }

      // Sorts initially
      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        events: events,
        title: `Events (${events.length})`,
      });
    }
    catch (error) {
      let message = error.response;
      if (message === undefined) {
        message = error.message;
      } else {
        message = error.response.data.message;
      }
      this.setState({ error: message, });
    }
    this.setState({ isLoading: false, });
  }

  render() {
    const { isLoading, isDeleting, error, events, eventName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <div key="process-name">
                <h4>
                  <br />
                  <Label bsStyle="primary" bsSize="large">{this.state.processName}</Label>
                  <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterEvent}>Add Event</Button>
                </h4>
              </div>
            </Col>
          </Row>
          <Row style={styles.row}>
            <Col md={12}>
              <span>&nbsp;</span>
            </Col>
          </Row>
          <Row style={styles.row}>
            <Col md={12}>
              <Card
                title={title}
                content={
                  <div>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Search Keyword</ControlLabel>
                        <FormControl placeholder="Search by Event Name"
                          type="text" defaultValue="" onChange={this.handleFilter} id="keyword" />
                      </FormGroup>
                    </Col>
                    <Col md={4}>
                      <FormGroup>
                        <ControlLabel>Sort By</ControlLabel>
                        <FormControl componentClass="select" defaultValue="asc" onChange={this.handleOrderChange}>
                          <option value="asc">A-Z</option>
                          <option value="desc">Z-A</option>
                        </FormControl>
                      </FormGroup>
                    </Col>
                    <div className="clearfix" />
                  </div>
                }
              />
            </Col>
          </Row>
          <Row style={styles.row}>
            {
              events.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No event found.</div>} />
              </Col>
            }
            {
              events
                .filter(event => event.visible)
                .map(event => {
                  return (
                    <Col md={4} key={event.name}>
                      <Card title={event.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>EventId</td>
                                  <td>{event.id}</td>
                                </tr>
                                <tr>
                                  <td>EventDescription</td>
                                  <td>{event.description}</td>
                                </tr>
                                <tr>
                                  <td>EventSMS</td>
                                  <td>{event.sms}</td>
                                </tr>
                                <tr>
                                  <td>EventEmail</td>
                                  <td>{event.email}</td>
                                </tr>
                                <tr>
                                  <td>EventPriority</td>
                                  <td>{event.priority}</td>
                                </tr>
                                <tr>
                                  <td>EventType</td>
                                  <td>{event.type}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(event.id, event.name)}>Delete</Button>
                            <div className="clearfix" />
                          </div>
                        }
                      />
                    </Col>
                  )
                })
            }
          </Row>
          {isLoading &&
            <Row>
              <Col md={12}>
                <div>
                  <ProgressBar active now={50} />
                </div>
              </Col>
            </Row>
          }
          {/* TODO: better UI for error */}
          {error &&
            <Row>
              <Col md={12}>
                <Alert bsStyle="danger">
                  <span>{this.state.error}</span>
                </Alert>
              </Col>
            </Row>
          }
        </Grid>
        <Modal show={this.state.show} onHide={this.handleDeleteClose}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Event</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the event {eventName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteEvent(this.state.eventId)}>Delete</Button>
          </Modal.Footer>
          {isDeleting &&
            <div>
              <ProgressBar active now={50} />
            </div>
          }
        </Modal>
      </div>
    );
  }
}

export default Event;
