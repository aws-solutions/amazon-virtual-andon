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
  Modal
} from 'react-bootstrap';

import { listSites } from "graphql/queries";
import { deleteSite } from "graphql/mutations";
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
class Factory extends Component {
  constructor(props) {
    super(props);

    this.handleRegisterSite = this.handleRegisterSite.bind(this);
    this.handleSite = this.handleSite.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleDeleteClose = this.handleDeleteClose.bind(this);
    this.handleFilter = this.handleFilter.bind(this);
    this.handleOrderChange = this.handleOrderChange.bind(this);

    // Sets up initial state
    this.state = {
      sites: [],
      error: false,
      isLoading: false,
      show: false,
      siteName: '',
      siteId: '',
      isDeleting: false,
      title: '',
    };
  }

  componentDidMount() {
    this.setState({ title: 'Sites', });
    this.getSites();
  }

  // Registers a site
  handleRegisterSite() {
    this.props.history.push('/sites/registration');
  }

  // Gets a site detail
  handleSite(siteId) {
    this.props.history.push(`/sites/${siteId}/areas`);
  }

  // Handles to delete a site
  handleDelete = (siteId, siteName) => {
    this.setState({
      siteName: siteName,
      siteId: siteId,
      show: true,
    });
  }

  // Delets a site
  deleteSite = async (siteId) => {
    if (!this.state.isDeleting) {
      this.setState({ isDeleting: true });
      const input = {
        id: siteId,
        expectedVersion: 1
      }
      try {
        await API.graphql(graphqlOperation(deleteSite, { input }))
        this.props.handleNotification('Site was deleted successfully', 'success', 'pe-7s-close-circle', 5);

        let updatedSites = this.state.sites.filter(site => site.id !== siteId);
        this.setState({
          sites: updatedSites,
          title: `Sites (${updatedSites.length})`
        });
      }
      catch (error) {
        this.props.handleNotification('Error occurred while deleting the site', 'error', 'pe-7s-close-circle', 5);
      }

      this.setState({
        isDeleting: false,
        show: false,
      });

    } else {
      this.props.handleNotification('Site is still deleting', 'warning', 'pe-7s-close-circle', 5);
    }
  }

  handleDeleteClose = () => {
    this.setState({ show: false });
  }

  // Handles input changes
  handleFilter = () => {
    // Gets element value directly due to the stale state
    let keyword = document.getElementById("keyword").value;
    let sites = this.state.sites;
    for (let i = 0; i < sites.length; i++) {
      let siteName = sites[i].name;
      logger.debug(`siteName: ${siteName}`)
      if (keyword === '') {
        // Empty keyword 
        sites[i].visible = true;
      } else {
        // Some keyword 
        if (siteName.indexOf(keyword) > -1) {
          sites[i].visible = true;
        } else {
          sites[i].visible = false;
        }
      }
    }
    this.setState({ sites: sites });
  }

  handleOrderChange = (event) => {
    let order = event.target.value;
    this.sortSites(order);
  };

  // Sorts sites
  sortSites = (order) => {
    let sites = this.state.sites;
    if (order === 'asc') {
      sites.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      sites.sort((a, b) => b.name.localeCompare(a.name));
    }

    this.setState({ sites: sites });
  };

  // Gets sites
  getSites = async () => {
    this.setState({ isLoading: true });
    try {
      //Graphql operation to get sites
      const response = await API.graphql(graphqlOperation(listSites, { limit: 50 }))

      let sites = response.data.listSites.items;

      // Adds visible key/value for filter
      for (let i = 0; i < sites.length; i++) {
        sites[i]['visible'] = true;
      }
      logger.debug(`sites: ${JSON.stringify(sites, null, 2)}`)
      // Sorts initially
      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        sites: sites,
        title: `Sites (${sites.length})`,
      });
    } catch (error) {

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
    const { isLoading, isDeleting, error, sites, siteName, title } = this.state;
    return (
      <div className="content">
        <Grid fluid>
          <Row style={styles.row}>
            <Col md={12}>
              <Button className="btn-fill pull-right" bsSize="small" bsStyle="warning" active onClick={this.handleRegisterSite}>Add Site</Button>
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
                        <FormControl placeholder="Search by Site Name"
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
              sites.length === 0 && !isLoading &&
              <Col md={12}>
                <Card content={<div>No site found.</div>} />
              </Col>
            }
            {
              sites
                .filter(site => site.visible)
                .map(site => {
                  return (
                    <Col md={4} key={site.name}>
                      <Card title={site.name}
                        content={
                          <div>
                            <Table striped bordered>
                              <tbody>
                                <tr>
                                  <td>SiteId</td>
                                  <td>{site.id}</td>
                                </tr>
                                <tr>
                                  <td>SiteDescription</td>
                                  <td>{site.description}</td>
                                </tr>
                              </tbody>
                            </Table>
                            <Button bsStyle="danger" bsSize="small"
                              className="btn-fill pull-left" active
                              onClick={() => this.handleDelete(site.id, site.name)}>Delete</Button>
                            <Button bsStyle="warning" bsSize="small"
                              className="btn-fill pull-right" active
                              onClick={() => this.handleSite(site.id)}>Detail</Button>
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
            <Modal.Title>Delete Site</Modal.Title>
          </Modal.Header>
          <Modal.Body>Are you sure to delete the site {siteName}?</Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleDeleteClose}>Close</Button>
            <Button bsStyle="primary" className="btn-fill" active onClick={() => this.deleteSite(this.state.siteId)}>Delete</Button>
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

export default Factory;
