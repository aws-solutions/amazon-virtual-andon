// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
// Import React and Amplify packages
import React from 'react';
import { CSVLink } from 'react-csv';
import { I18n } from 'aws-amplify';
import { Logger } from '@aws-amplify/core';

// Import React Bootstrap components
import Alert from 'react-bootstrap/Alert';
import Breadcrumb from 'react-bootstrap/Breadcrumb';
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup'
import ProgressBar from 'react-bootstrap/ProgressBar';
import Row from 'react-bootstrap/Row';


// Import custom setting
import { LOGGING_LEVEL, convertSecondsToHms } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IGeneralQueryData, IIssue, ISelectedData } from '../components/Interfaces';
import { SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';
import DataTable from '../components/DataTable';

// Logging
const LOGGER = new Logger('IssuesReporting', LOGGING_LEVEL);

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  issues: IIssue[];
  sites: IGeneralQueryData[];
  areas: IGeneralQueryData[];
  selectedSite: ISelectedData;
  selectedArea: ISelectedData;
  isLoading: boolean;
  error: string;
  showIssuesTable: boolean;
  prevDayIssuesStats: any;
  startDate: any;
  endDate: any;
  currentDate: any;
}

/**
 * The Issues Report page
 * @class IssuesReport
 */
class IssuesReport extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      issues: [],
      sites: [],
      areas: [],
      selectedSite: { id: '', name: '' },
      selectedArea: { id: '', name: '' },
      isLoading: false,
      error: '',
      showIssuesTable: false,
      prevDayIssuesStats: {},
      startDate: '',
      endDate: '',
      currentDate: new Date().toISOString().split('T')[0]
    };

    this.graphQlCommon = new GraphQLCommon();

    this.handleSiteChange = this.handleSiteChange.bind(this);
    this.handleAreaChange = this.handleAreaChange.bind(this);
    this.setStartDate = this.setStartDate.bind(this);
    this.getIssuesByQuery = this.getIssuesByQuery.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get Issues reported in the last 24 hours
    this.getPrevDayIssuesStats();
    // Get sites at page load
    this.getSites();
  }

  /**
   * Get Issues reported in the last 24 hours
   */
  async getPrevDayIssuesStats() {
    try {
      const prevDayIssuesStats: IGeneralQueryData[] = await this.graphQlCommon.getPrevDayIssuesStats();
      if (prevDayIssuesStats)
        this.setState({ prevDayIssuesStats });
    } catch (error) {
      LOGGER.error('Error while getting prevDayIssuesStats', error);
      this.setState({ error: I18n.get('error.get.prevDayIssuesStats') });
    }
  }
  /**
   * Get sites
   */
  async getSites() {
    try {
      const sites: IGeneralQueryData[] = await this.graphQlCommon.listSites();

      if (sites.length === 1) {
        const selectedSite = {
          id: sites[0]['id'],
          name: sites[0]['name']
        };

        this.setState({ selectedSite });
        this.getAreas(selectedSite);
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ sites });
    } catch (error) {
      LOGGER.error('Error while getting sites', error);
      this.setState({ error: I18n.get('error.get.sites') });
    }
  }

  /**
   * Get areas
   * @param {object} selectedSite - Selected site
   */
  async getAreas(selectedSite: ISelectedData) {
    try {
      const siteId = selectedSite.id;
      const areas: IGeneralQueryData[] = await this.graphQlCommon.listAreas(siteId as string);

      if (areas.length === 1) {
        const selectedArea = {
          id: areas[0]['id'],
          name: areas[0]['name']
        };

        this.setState({ selectedArea });
      }

      areas.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({ areas });
    } catch (error) {
      LOGGER.error('Error while getting areas', error);
      this.setState({ error: I18n.get('error.get.areas') });
    }
  }

  /**
   * Get issues for the selected Site, Area (optional) between Start and End Dates.
   * @param {object} event - Event form the form.
   */
  async getIssuesByQuery(event: any) {
    // Don't reload the page, on form submit.
    event.preventDefault()

    const formData = new FormData(event.target),
      formDataObj = Object.fromEntries(formData.entries())
    this.setState({
      showIssuesTable: false,
      isLoading: true
    });
    try {
      const selectedSiteName = formDataObj.siteName;
      const selectedAreaName = formDataObj.siteArea;
      // @ts-ignore
      const startDate = new Date(formDataObj.startDate);
      // @ts-ignore
      const endDate = new Date(formDataObj.endDate);
      // To include the selected end date in query, change date to next day midnight.
      endDate.setDate(endDate.getDate() + 1)

      const input: any = {
        siteName: selectedSiteName,
        filter: { created: { between: [startDate, endDate] } },
        limit: 40
      };

      if (selectedAreaName)
        input.areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated = { beginsWith: { areaName: selectedAreaName } }

      const issues: IIssue[] = await this.graphQlCommon.listIssuesBySiteAreaStatus(input);
      // Calculate Open For time for all open issues.
      this.calculateOpenFor(issues)

      this.setState({
        issues,
        showIssuesTable: true,
        isLoading: false
      });
    } catch (error) {
      LOGGER.error('Error while getting issues', error);
      this.setState({ error: I18n.get('error.get.issues') });
    }
  }

  /**
   * Handle site select change event.
   * @param {any} event - Event from the site select
   */
  handleSiteChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedSite = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };

    this.setState({
      selectedSite,
      selectedArea: { id: '', name: '' },
      issues: [],
      showIssuesTable: false
    });
    this.getAreas(selectedSite);
  }

  /**
   * Handle area select change event.
   * @param {any} event - Event from the area select
   */
  handleAreaChange(event: any) {
    const index = event.target.options.selectedIndex;
    const selectedArea = {
      id: event.target.options[index].getAttribute('data-key'),
      name: event.target.value
    };
    this.setState({
      selectedArea,
      issues: [],
      showIssuesTable: false
    });
  }

  setStartDate(event: any) {
    this.setState({
      startDate: event.target.value
    })
  }
  /**
   * Calculates OpenFor time in seconds for all open issues.
   * If the issue has resolutionTime, then no need to calculate.
   * If the issue is in Open State, then calculate the time between createAt and now.
   * @param {IIssue[]} issues - Array of Issues.
   */
  calculateOpenFor(issues: IIssue[]) {
    issues.forEach(issue => {
      if (issue.resolutionTime) {
        issue.openFor = issue.resolutionTime
      } else {
        let dateNow: Date = new Date()
        let dateOpened: Date = new Date(issue.createdAt)
        issue.openFor = (dateNow.getTime() - dateOpened.getTime()) / 1000
      }
    })
  }

  /**
   * Render this page.
   */
  render() {
    const headers = [
      { name: I18n.get('text.process.name'), key: 'processName' },
      { name: I18n.get('text.event.description'), key: 'eventDescription' },
      { name: I18n.get('text.device.name'), key: 'deviceName' },
      { name: I18n.get('text.status'), key: 'status' },
      { name: I18n.get('text.rootcause'), key: 'rootCause' },
      { name: I18n.get('text.comment'), key: 'comment' },
      { name: I18n.get('text.openfor'), key: 'openFor', callFunction: convertSecondsToHms, keyType: 'number' },
      { name: I18n.get('text.created.at'), key: 'createdAt' },
      { name: I18n.get('text.closed.at'), key: 'closed' },
      { name: I18n.get('text.createdby'), key: 'createdBy' },
      { name: I18n.get('text.acknowledgedby'), key: 'acknowledgedBy' },
      { name: I18n.get('text.closedby'), key: 'closedBy' },
    ];

    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Breadcrumb>
                <Breadcrumb.Item active>{I18n.get('text.issues.report')}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Card>
                <Card.Header><strong>{I18n.get('text.issues.report.24hourSummary')}</strong></Card.Header>
                <Card.Body>
                  <Row>
                    <Col><h6 id="totalIssues">{I18n.get('text.issues.report.TotalIssues')} : {this.state.prevDayIssuesStats.open + this.state.prevDayIssuesStats.acknowledged + this.state.prevDayIssuesStats.closed}</h6></Col>
                    <Col><h6 id="issuesOpen">{I18n.get('text.issues.report.Open')} : {this.state.prevDayIssuesStats.open}</h6></Col>
                    <Col><h6 id="issuesAck">{I18n.get('text.issues.report.Acknowledged')} : {this.state.prevDayIssuesStats.acknowledged}</h6></Col>
                    <Col><h6 id="issuesClosed">{I18n.get('text.issues.report.Closed')} : {this.state.prevDayIssuesStats.closed}</h6></Col>
                    <Col><h6 id="issuesOpenedLast3Hours">{I18n.get('text.issues.report.OpenedLast3Hours')} : {this.state.prevDayIssuesStats.lastThreeHours}</h6></Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <EmptyRow />
          <Row>
            <Col>
              <Card>
                <Card.Header><strong>{I18n.get('text.search.title')}</strong></Card.Header>
                <Card.Body>
                  <Form onSubmit={this.getIssuesByQuery}>
                    <Form.Row>
                      <Form.Group as={Col} md={2} controlId="siteSelect">
                        <Form.Label>{I18n.get('text.select.site.issues')}</Form.Label>
                        <Form.Control as="select" name="siteName" value={this.state.selectedSite.name} onChange={this.handleSiteChange} required>
                          <option data-key="" key="none-site" value="">{I18n.get('text.select.site')}</option>
                          {
                            this.state.sites.map((site: IGeneralQueryData) => {
                              return (
                                <option data-key={site.id} key={site.id} value={site.name}>{site.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} md={3} controlId="areaSelect">
                        <Form.Label>{I18n.get('text.select.area.issues')}</Form.Label>
                        <Form.Control as="select" disabled={this.state.selectedSite.id === '' ? true : false} name="siteArea" value={this.state.selectedArea.name} onChange={this.handleAreaChange}>
                          <option data-key="" key="none-area" value="">{I18n.get('text.select.area')}</option>
                          {
                            this.state.areas.map((area: IGeneralQueryData) => {
                              return (
                                <option data-key={area.id} key={area.id} value={area.name}>{area.name}</option>
                              );
                            })
                          }
                        </Form.Control>
                      </Form.Group>
                      <Form.Group as={Col} md={2} controlId="startDate">
                        <Form.Label>{I18n.get('text.select.dates')}</Form.Label>
                        <Col><Form.Control type="date" name="startDate" placeholder="Start Date" onChange={this.setStartDate} max={this.state.currentDate} required /></Col>
                      </Form.Group>
                      <Form.Group as={Col} md={2} controlId="endDate">
                        <Form.Label><EmptyRow></EmptyRow></Form.Label>
                        <Col><Form.Control type="date" name="endDate" placeholder="End Date" min={this.state.startDate} max={this.state.currentDate} required /></Col>
                      </Form.Group>
                      <Form.Group as={Col} md={2} controlId="downloadIssues">
                        <Form.Label><EmptyRow></EmptyRow></Form.Label>
                        <InputGroup className="mb-3">
                          <Button className='ml-2 mr-2' id="getIssues" type="submit">{I18n.get('button.submit')}</Button>
                            {
                              this.state.issues.length > 0 &&
                              <CSVLink id="downloadIssues" data={this.state.issues} className="btn btn-primary">{I18n.get('button.download.csv.data')}</CSVLink>
                            }
                            {
                              this.state.issues.length == 0 &&
                              <Button id="downloadIssuesDisabled" className="btn btn-primary" disabled>{I18n.get('button.download.csv.data')}</Button>
                            }
                        </InputGroup>
                      </Form.Group>
                    </Form.Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          {
            this.state.showIssuesTable &&
            <div>
              <EmptyRow />
              <Row>
                <Col>
                  <Card className="custom-card-big">
                    <Card.Body>
                      <DataTable headers={headers} data={this.state.issues} initialSort={{ key: 'count', order: SortBy.Desc, keyType: 'number' }}
                        handleNotification={this.props.handleNotification} />
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
          }
          {
            !this.state.showIssuesTable &&
            <div>
              <EmptyRow />
              <Card className="text-center">
                <Card.Header id="issuesTableEmptyState">{I18n.get('text.search.help')} </Card.Header>
              </Card>
            </div>
          }
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
                  <strong>{I18n.get('error')}:</strong><br />
                  {this.state.error}
                </Alert>
              </Col>
            </Row>
          }
        </Container>
      </div>
    );
  }
}

export default IssuesReport;