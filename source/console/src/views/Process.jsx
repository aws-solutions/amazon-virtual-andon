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
import { deleteProcess } from "graphql/mutations";
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
class Process extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterProcess = this.handleRegisterProcess.bind(this);
    this.handleProcess = this.handleProcess.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      processes: [],
      areaId: '',
      areaName: '',
      error: false,
      isLoading: false,
      show: false,
      processName: '',
      processId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Processes', });
    this.getArea();
  }

  // Registers a Process
  handleRegisterProcess() {
    this.props.history.push(`/areas/${this.state.areaId}/processRegistration`);
  }

  // Gets a Process detail
  handleProcess(processId) {
    this.props.history.push(`/processes/${processId}/events`);
  }

  // Handles to delete a process
  handleDelete = (processId, processName) => {
    this.setState({
      processName: processName,
      processId: processId,
      show: true,
    });
  }

  // Delets a process
  deleteProcess = async (processId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: processId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteProcess, { input }))
        this.props.handleNotification('Process was deleted successfully', 'success', 'pe-7s-close-circle', 5);
        let updatedProcess = this.state.processes.filter(process => process.id !== processId);
        this.setState({
          processes: updatedProcess,
          title: `Processes (${updatedProcess.length})`
        });
      }
      catch (error) {
        logger.error(error)
        this.props.handleNotification('Error occurred while deleting the process', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Process is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let processes = this.state.processes;

    for (let i = 0; i < processes.length; i++) {
      let processName = processes[i].name;
      if (keyword === '') {
        // Empty keyword 
        processes[i].visible = true;
      }
      else {
        // Some keyword 
        if (processName.indexOf(keyword) > -1) {
          processes[i].visible = true;
        } else {
          processes[i].visible = false;
        }
      }
    }

    this.setState({ processes: processes });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortProcess(order);
  };

  // Sorts processs
  sortProcess = (order) => {
    let processs = this.state.processs;
    if (order === 'asc') {
      processs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      processs.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ processs: processs });
  };

  // Gets site processs
  getArea = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get processs
      const { areaId } = this.props.match.params;
      this.setState({ areaId })
      const response = await API.graphql(graphqlOperation(getArea, { id: areaId }))
      let processes = response.data.getArea.process.items;
      let areaName = response.data.getArea.name
      this.setState({ areaName })
      // Adds visible key/value for filter
      for (let i = 0; i < processes.length; i++) {
        processes[i]['visible'] = true;
      }

      // Sorts initially
      processes.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        processes: processes,
        title: `Processes (${processes.length})`,
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
    const { isLoading, isDeleting, error, processes, processName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <div key="area-name">
                <h4>
                  <br />
                  <Label bsStyle="primary" bsSize="large">{this.state.areaName}</Label>
                  <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterProcess}>Add Process</Button>
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
                        <FormControl placeholder="Search by Process Name"
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
              processes.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No process found.</div>} />
              </Col>
            }
            {
              processes
                .filter(process => process.visible)
                .map(process => {
                  return (
                    <Col md={4} key={process.name}>
                      <Card title={process.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>ProcessId</td>
                                  <td>{process.id}</td>
                                </tr>
                                <tr>
                                  <td>ProcessDescription</td>
                                  <td>{process.description}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(process.id, process.name)}>Delete</Button>
                            <Button bsStyle="warning" bsSize="small"
                              className="btn-fill pull-right" active
                              onClick={() => this.handleProcess(process.id)}>Detail</Button>
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
            <Modal.Title>Delete Process</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the process {processName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteProcess(this.state.processId)}>Delete</Button>
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

export default Process;
