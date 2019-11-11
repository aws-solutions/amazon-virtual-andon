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

import { getSite } from "graphql/queries";
import { deleteArea } from "graphql/mutations";
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

class Area extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterArea = this.handleRegisterArea.bind(this);
    this.handleAreaP = this.handleAreaP.bind(this);
    this.handleAreaS = this.handleAreaS.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      areas: [],
      siteId: '',
      siteName: '',
      error: false,
      isLoading: false,
      show: false,
      areaName: '',
      areaId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Areas', });
    this.getSite();
  }

  // Registers a Area
  handleRegisterArea() {
    this.props.history.push(`/sites/${this.state.siteId}/areaRegistration`);
  }

  // Gets a Area - Process detail
  handleAreaP(areaId) {
    this.props.history.push(`/areas/${areaId}/processes`);
  }

  // Gets a Area - Station detail  
  handleAreaS(areaId) {
    this.props.history.push(`/areas/${areaId}/stations`);
  }

  // Handles to delete a area
  handleDelete = (areaId, areaName) => {
    this.setState({
      areaName: areaName,
      areaId: areaId,
      show: true,
    });
  }

  // Delets a area
  deleteArea = async (areaId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: areaId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteArea, { input }))
        this.props.handleNotification('Area was deleted successfully', 'success', 'pe-7s-close-circle', 5);
        let updatedAreas = this.state.areas.filter(area => area.id !== areaId);
        this.setState({
          areas: updatedAreas,
          title: `Areas (${updatedAreas.length})`
        });
      }
      catch (error) {
        logger.error(JSON.stringify(error, null, 2))
        this.props.handleNotification('Error occurred while deleting the area', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Area is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let areas = this.state.areas;

    for (let i = 0; i < areas.length; i++) {
      let areaName = areas[i].name;
      if (keyword === '') {
        // Empty keyword 
        areas[i].visible = true;
      }
      else {
        // Some keyword 
        if (areaName.indexOf(keyword) > -1) {
          areas[i].visible = true;
        } else {
          areas[i].visible = false;
        }
      }
    }

    this.setState({ areas: areas });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortAreas(order);
  };

  // Sorts areas
  sortAreas = (order) => {
    let areas = this.state.areas;
    if (order === 'asc') {
      areas.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      areas.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ areas: areas });
  };

  // Gets site areas
  getSite = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get areas
      const { siteId } = this.props.match.params;
      this.setState({ siteId })
      const response = await API.graphql(graphqlOperation(getSite, { id: siteId }))
      let areas = response.data.getSite.area.items;
      let siteName = response.data.getSite.name;
      this.setState({ siteName })

      // Adds visible key/value for filter
      for (let i = 0; i < areas.length; i++) {
        areas[i]['visible'] = true;
      }

      // Sorts initially
      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        areas: areas,
        title: `Areas (${areas.length})`,
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
    const { isLoading, isDeleting, error, areas, areaName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <div key="site-name">
                <h4>
                  <br />
                  <Label bsStyle="primary" bsSize="large">{this.state.siteName}</Label>
                  <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterArea}>Add Area</Button>
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
                        <FormControl placeholder="Search by Area Name"
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
              areas.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No area found.</div>} />
              </Col>
            }
            {
              areas
                .filter(area => area.visible)
                .map(area => {
                  return (
                    <Col md={4} key={area.name}>
                      <Card title={area.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>AreaId</td>
                                  <td>{area.id}</td>
                                </tr>
                                <tr>
                                  <td>AreaDescription</td>
                                  <td>{area.description}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(area.id, area.name)}>Delete</Button>
                            <div class="btn-toolbar">
                              <Button bsStyle="warning" bsSize="small"
                                className="btn-fill pull-right" active
                                onClick={() => this.handleAreaP(area.id)}>Process Detail</Button>
                              <Button bsStyle="warning" bsSize="small"
                                className="btn-fill pull-right" active
                                onClick={() => this.handleAreaS(area.id)}>Station Detail</Button>
                            </div>
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
            <Modal.Title>Delete Area</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the area {areaName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteArea(this.state.areaId)}>Delete</Button>
          </Modal.Footer>
          {isDeleting &&
            <div>
              <ProgressBar active now={50} />
            </div>
          }
        </Modal>
      </div >
    );
  }
}

export default Area;
