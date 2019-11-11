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

import { getStation } from "graphql/queries";
import { deleteDevice } from "graphql/mutations";
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
class Device extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterDevice = this.handleRegisterDevice.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      devices: [],
      stationName: '',
      error: false,
      isLoading: false,
      show: false,
      deviceName: '',
      deviceId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Devices', });
    this.getStation();
  }

  // Registers a Device
  handleRegisterDevice() {
    this.props.history.push(`/stations/${this.state.stationId}/deviceRegistration`);
  }

  // Handles to delete a device
  handleDelete = (deviceId, deviceName) => {
    this.setState({
      deviceName: deviceName,
      deviceId: deviceId,
      show: true,
    });
  }

  // Delets a device
  deleteDevice = async (deviceId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: deviceId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteDevice, { input }))
        this.props.handleNotification('Device was deleted successfully', 'success', 'pe-7s-close-circle', 5);
        let updatedDevice = this.state.devices.filter(device => device.id !== deviceId);
        this.setState({
          devices: updatedDevice,
          title: `Devices (${updatedDevice.length})`
        });
      }
      catch (error) {
        logger.error(error)
        this.props.handleNotification('Error occurred while deleting the device', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Device is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let devices = this.state.devices;

    for (let i = 0; i < devices.length; i++) {
      let deviceName = devices[i].name;
      if (keyword === '') {
        // Empty keyword 
        devices[i].visible = true;
      }
      else {
        // Some keyword 
        if (deviceName.indexOf(keyword) > -1) {
          devices[i].visible = true;
        } else {
          devices[i].visible = false;
        }
      }
    }

    this.setState({ devices: devices });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortDevice(order);
  };

  // Sorts devices
  sortDevice = (order) => {
    let devices = this.state.devices;
    if (order === 'asc') {
      devices.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      devices.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ devices: devices });
  };

  // Gets site devices
  getStation = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get devices
      const { stationId } = this.props.match.params;
      this.setState({ stationId })
      const response = await API.graphql(graphqlOperation(getStation, { id: stationId }))
      let devices = response.data.getStation.device.items;
      let stationName = response.data.getStation.name;
      this.setState({ stationName })
      // Adds visible key/value for filter
      devices.forEach(d => d.visible = true)

      // Sorts initially
      devices.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        devices: devices,
        title: `Devices (${devices.length})`,
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
    const { isLoading, isDeleting, error, devices, deviceName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <div key="station-name">
                <h4>
                  <br />
                  <Label bsStyle="primary" bsSize="large">{this.state.stationName}</Label>
                  <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterDevice}>Add Device</Button>
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
                        <FormControl placeholder="Search by Device Name"
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
              devices.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No device found.</div>} />
              </Col>
            }
            {
              devices
                .filter(device => device.visible)
                .map(device => {
                  return (
                    <Col md={4} key={device.name}>
                      <Card title={device.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>DeviceId</td>
                                  <td>{device.id}</td>
                                </tr>
                                <tr>
                                  <td>DeviceDescription</td>
                                  <td>{device.description}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(device.id, device.name)}>Delete</Button>
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
            <Modal.Title>Delete Device</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the device {deviceName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteDevice(this.state.deviceId)}>Delete</Button>
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

export default Device;
