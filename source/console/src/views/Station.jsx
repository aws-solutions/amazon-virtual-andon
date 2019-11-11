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

import { getArea } from "graphql/queries";
import { deleteStation } from "graphql/mutations";
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
class Station extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterStation = this.handleRegisterStation.bind(this);
    this.handleStation = this.handleStation.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      stations: [],
      areaId: '',
      areaName: '',
      error: false,
      isLoading: false,
      show: false,
      stationName: '',
      stationId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Stations', });
    this.getArea();
  }

  // Registers a Station
  handleRegisterStation() {
    this.props.history.push(`/areas/${this.state.areaId}/stationRegistration`);
  }

  // Gets a Station detail
  handleStation(stationId) {
    this.props.history.push(`/stations/${stationId}/devices`);
  }

  // Handles to delete a station
  handleDelete = (stationId, stationName) => {
    this.setState({
      stationName: stationName,
      stationId: stationId,
      show: true,
    });
  }

  // Delets a station
  deleteStation = async (stationId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: stationId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteStation, { input }))
        this.props.handleNotification('Station was deleted successfully', 'success', 'pe-7s-close-circle', 5);
        let updatedStation = this.state.stations.filter(station => station.id !== stationId);
        this.setState({
          stations: updatedStation,
          title: `Stations (${updatedStation.length})`
        });
      }
      catch (error) {
        logger.error(error)
        this.props.handleNotification('Error occurred while deleting the station', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Station is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let stations = this.state.stations;

    for (let i = 0; i < stations.length; i++) {
      let stationName = stations[i].name;
      if (keyword === '') {
        // Empty keyword 
        stations[i].visible = true;
      }
      else {
        // Some keyword 
        if (stationName.indexOf(keyword) > -1) {
          stations[i].visible = true;
        } else {
          stations[i].visible = false;
        }
      }
    }

    this.setState({ stations: stations });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortStation(order);
  };

  // Sorts stations
  sortStation = (order) => {
    let stations = this.state.stations;
    if (order === 'asc') {
      stations.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      stations.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ stations: stations });
  };

  // Gets site stations
  getArea = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get stations
      const { areaId } = this.props.match.params;
      this.setState({ areaId })
      const response = await API.graphql(graphqlOperation(getArea, { id: areaId }))
      let stations = response.data.getArea.station.items;
      let areaName = response.data.getArea.name;
      this.setState({ areaName })

      // Adds visible key/value for filter
      for (let i = 0; i < stations.length; i++) {
        stations[i]['visible'] = true;
      }

      // Sorts initially
      stations.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        stations: stations,
        title: `Stations (${stations.length})`,
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
    const { isLoading, isDeleting, error, stations, stationName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <div key="area-name">
                <h4>
                  <br />
                  <Label bsStyle="primary" bsSize="large">{this.state.areaName}</Label>
                  <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterStation}>Add Station</Button>
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
                        <FormControl placeholder="Search by Station Name"
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
              stations.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No station found.</div>} />
              </Col>
            }
            {
              stations
                .filter(station => station.visible)
                .map(station => {
                  return (
                    <Col md={4} key={station.name}>
                      <Card title={station.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>StationId</td>
                                  <td>{station.id}</td>
                                </tr>
                                <tr>
                                  <td>StationDescription</td>
                                  <td>{station.description}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(station.id, station.name)}>Delete</Button>
                            <Button bsStyle="warning" bsSize="small"
                              className="btn-fill pull-right" active
                              onClick={() => this.handleStation(station.id)}>Detail</Button>
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
            <Modal.Title>Delete Station</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the station {stationName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteStation(this.state.stationId)}>Delete</Button>
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

export default Station;
