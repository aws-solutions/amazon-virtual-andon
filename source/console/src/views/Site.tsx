/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

// Import React and Amplify packages
import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Jumbotron from 'react-bootstrap/Jumbotron';
import Table from 'react-bootstrap/Table';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';

// Import graphql
import { createSite } from '../graphql/mutations';

// Import custom setting
import { LOGGING_LEVEL, sendMetrics, validateGeneralInput, sortByName, getLocaleString, getInputFormValidationClassName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData } from '../components/Interfaces';
import { ModalType, SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  title: string;
  sites: IGeneralQueryData[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  siteId: string;
  siteName: string;
  siteDescription: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isSiteNameValid: boolean;
  isSiteDescriptionValid: boolean;
}

// Logging
const LOGGER = new Logger('Site', LOGGING_LEVEL);

/**
 * The site page
 * @class Site
 */
class Site extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: getLocaleString('Sites'),
      sites: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      siteId: '',
      siteName: '',
      siteDescription: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isSiteNameValid: false,
      isSiteDescriptionValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteSite = this.deleteSite.bind(this);
    this.addSite = this.addSite.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleSiteNameChange = this.handleSiteNameChange.bind(this);
    this.handleSiteDescriptionChange = this.handleSiteDescriptionChange.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    await this.getSites();
  }

  /**
   * Get sites.
   */
  async getSites() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      const sites: IGeneralQueryData[] = await this.graphQlCommon.listSites();

      // Make all sites visible.
      makeAllVisible(sites);

      // Sorts initially
      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        sites,
        title: `${getLocaleString('Sites')} (${sites.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting sites', error);
      this.setState({ error: getLocaleString('Error occurred while getting sites.') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete a site.
   */
  async deleteSite() {
    this.setState({ isModalProcessing: true });

    try {
      // This will delete every area, process, station, event, and device belonged to the site as well.
      const { siteId } = this.state;
      await this.graphQlCommon.deleteSite(siteId);

      const updatedSites = this.state.sites.filter(site => site.id !== siteId);

      this.props.handleNotification(getLocaleString('Site was deleted successfully.'), 'success', 5);
      this.setState({
        sites: updatedSites,
        title: `${getLocaleString('Sites')} (${updatedSites.length})`,
        siteId: '',
        siteName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = getLocaleString('Error occurred while deleting the site.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        }
      }

      LOGGER.error('Error while deleting site', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Register a site.
   */
  async addSite() {
    this.setState({ isModalProcessing: true });

    try {
      // Graphql operation to register site
      const { sites, siteName, siteDescription, searchKeyword, sort } = this.state;
      const input = {
        name: siteName,
        description: siteDescription,
        __typename: 'Site'
      };

      const response = await API.graphql(graphqlOperation(createSite, input));
      let newSite: IGeneralQueryData = response.data.createSite;
      newSite.visible = searchKeyword === '' || newSite.name.toLowerCase().includes(searchKeyword.toLowerCase());

      const newSites = [...sites, newSite];
      this.setState({
        sites: sortByName(newSites, sort, 'name'),
        title: `${getLocaleString('Sites')} (${newSites.length})`,
        siteName: '',
        siteDescription: '',
        isModalProcessing: false,
        isSiteNameValid: false,
        isSiteDescriptionValid: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });

      this.props.handleNotification(getLocaleString('Site was added successfully.'), 'info', 5);
      await sendMetrics({ 'site': 1 });
    } catch (error) {
      let message = getLocaleString('Error occurred while creating a site.');

      if (error.errors) {
        const { errorType } = error.errors[0];

        if (errorType === 'Unauthorized') {
          message = getLocaleString('Not authorized, please contact your Admin.');
        } else if (errorType === 'DataDuplicatedError') {
          message = getLocaleString('Site name already exists.');
        }
      }

      LOGGER.error('Error while adding site', error);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType - Moddal type
   * @param {string | undefined} siteId - Site ID
   * @param {string | undefined} siteName - Site Name
   */
  openModal(modalType: ModalType, siteId?: string, siteName?: string) {
    let modalTitle = '';

    if (modalType === ModalType.Add) {
      modalTitle = getLocaleString('Site Registration');
    } else if (modalType === ModalType.Delete) {
      modalTitle = getLocaleString('Delete Site');
    } else {
      this.props.handleNotification(`${getLocaleString('Unsupported modal type')}: ${modalType}`, 'warning', 5);
      return;
    }

    this.setState({
      modalType,
      modalTitle,
      siteId: siteId ? siteId : '',
      siteName: siteName ? siteName : '',
      showModal: true
    });
  }

  /**
   * Handle the search keyword change to filter the site result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { sites } = this.state;

    makeVisibleBySearchKeyword(sites, 'name', searchKeyword);
    this.setState({ sites, searchKeyword });
  }

  /**
   * Handle sites sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const sites = sortByName(this.state.sites, sort, 'name');

    this.setState({ sites, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      siteId: '',
      siteName: '',
      siteDescription: '',
      isSiteNameValid: false,
      isSiteDescriptionValid: false,
      showModal: false
    });
  }

  /**
   * Handle the site name change.
   * @param {any} event - Event from the site name input
   */
  handleSiteNameChange(event: any) {
    const siteName = event.target.value;
    const isSiteNameValid = validateGeneralInput(siteName);

    this.setState({
      siteName,
      isSiteNameValid
    });
  }

  /**
   * Handle the site description change.
   * @param {any} event - Event from the site description input
   */
  handleSiteDescriptionChange(event: any) {
    const siteDescription = event.target.value;
    const isSiteDescriptionValid = validateGeneralInput(siteDescription);

    this.setState({
      siteDescription,
      isSiteDescriptionValid
    });
  }

  /**
   * Render this page.
   */
  render() {
    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{ getLocaleString('Sites') }</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.openModal(ModalType.Add)}>{ getLocaleString('Add Site') }</Button>
                </Form.Row>
              </Form>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>{this.state.title}</Card.Title>
                  <Form>
                    <Form.Row>
                      <Form.Group as={Col} md={4} controlId="searchKeyword">
                        <Form.Label>{ getLocaleString('Search Keyword') }</Form.Label>
                        <Form.Control type="text" placeholder={ getLocaleString('Search by Site Name') } defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{ getLocaleString('Sort By') }</Form.Label>
                        <Form.Control as="select" defaultValue={this.state.sort} onChange={this.handleSort}>
                          <option value={SortBy.Asc}>A-Z</option>
                          <option value={SortBy.Desc}>Z-A</option>
                        </Form.Control>
                      </Form.Group>
                    </Form.Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            {
              this.state.sites.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{ getLocaleString('No site found.') }</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.sites.filter((site: IGeneralQueryData) => site.visible)
                .map((site: IGeneralQueryData) => {
                  return (
                    <Col md={4} key={site.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>{site.name}</Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{ getLocaleString('Description') }</td>
                                <td>{site.description}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, site.id, site.name)}>{ getLocaleString('Delete') }</Button>
                              <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/sites/${site.id}`)}>{ getLocaleString('Detail') }</Button>
                            </Form.Row>
                          </Form>
                        </Card.Body>
                      </Card>
                    </Col>
                  );
                })
            }
          </Row>
          {
            this.state.isLoading &&
            <Row>
              <Col>
                <ProgressBar animated now={100} />
              </Col>
            </Row>
          }
          {
            this.state.error &&
            <Row>
              <Col>
                <Alert variant="danger">
                  <strong>{ getLocaleString('Error') }:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
        <Modal show={this.state.showModal} onHide={this.handleModalClose}>
          <Modal.Header>
            <Modal.Title>{this.state.modalTitle}</Modal.Title>
          </Modal.Header>
          {
            this.state.modalType === ModalType.Add &&
            <div>
              <Modal.Body>
                <Form>
                  <Form.Group controlId="siteName">
                    <Form.Label>{ getLocaleString('Site Name') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the site name') }
                      defaultValue="" onChange={this.handleSiteNameChange} className={ getInputFormValidationClassName(this.state.siteName, this.state.isSiteNameValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                  <Form.Group controlId="siteDescription">
                    <Form.Label>{ getLocaleString('Site Description') } <span className="required-field">*</span></Form.Label>
                    <Form.Control required type="text" placeholder={ getLocaleString('Enter the site description') }
                      defaultValue="" onChange={this.handleSiteDescriptionChange} className={ getInputFormValidationClassName(this.state.siteDescription, this.state.isSiteDescriptionValid) } />
                    <Form.Text className="text-muted">{ `(${getLocaleString('Required')}) ${getLocaleString('Must contain only alphanumeric characters and/or the following: - _/# with length 4 to 40')}` }</Form.Text>
                  </Form.Group>
                </Form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="primary" onClick={this.addSite} disabled={this.state.isModalProcessing || !this.state.isSiteNameValid || !this.state.isSiteDescriptionValid}>{ getLocaleString('Register') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                { getLocaleString('Are you sure you want to delete this site') }: <strong>{this.state.siteName}</strong>?
                <EmptyRow />
                <Alert variant="danger">
                  { getLocaleString('Every area, station, device, process, and event belonged to the site will be deleted as well.') }
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={this.handleModalClose}>{ getLocaleString('Close') }</Button>
                <Button variant="danger" onClick={this.deleteSite} disabled={this.state.isModalProcessing}>{ getLocaleString('Delete') }</Button>
              </Modal.Footer>
            </div>
          }
          {
            this.state.isModalProcessing &&
            <ProgressBar animated now={100} />
          }
        </Modal>
      </div>
    );
  }
}

export default Site;