// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React, Amplify, and AWS SDK packages
import React from 'react';
import { LinkContainer } from 'react-router-bootstrap';
import { API, graphqlOperation, I18n, Storage } from 'aws-amplify';
import { GraphQLResult } from '@aws-amplify/api-graphql';
import { Logger } from '@aws-amplify/core';
import { AmplifyS3Image } from "@aws-amplify/ui-react";

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
import { getProcess } from '../graphql/queries';

// Import custom setting
import { LOGGING_LEVEL, sortByName, makeAllVisible, makeVisibleBySearchKeyword } from '../util/CustomUtil';
import GraphQLCommon from '../util/GraphQLCommon';
import { IEvent } from '../components/Interfaces';
import { ModalType, EventPriority, SortBy } from '../components/Enums';
import EmptyRow from '../components/EmptyRow';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {
  history?: any;
  match?: any;
  handleNotification: Function;
}

/**
 * State Interface
 * @interface IState
 */
interface IState {
  title: string;
  events: IEvent[];
  isLoading: boolean;
  searchKeyword: string;
  sort: SortBy;
  error: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  processId: string;
  processName: string;
  eventId: string;
  eventName: string;
  eventDescription: string;
  eventSms: string;
  eventEmail: string;
  eventPriority: EventPriority;
  eventType: string;
  eventTopicArn: string;
  modalType: ModalType;
  modalTitle: string;
  showModal: boolean;
  isModalProcessing: boolean;
  isEventNameValid: boolean;
  isEventDescriptionValid: boolean;
  isEventSmsValid: boolean;
  isEventEmailValid: boolean;
  isEventTypeValid: boolean;
  selectAllRootCauses: boolean;
  eventImgKeys: string[];
  eventImgKey: string;
  eventModalError: string;
  showEventImageLibrary: boolean;
  eventAlias: string;
  isEventAliasValid: boolean;
}

/**
 * Types of subscriptions that will be maintained by the main Event class
 */
export enum EventSubscriptionTypes {
  CREATE_ROOT_CAUSE,
  DELETE_ROOT_CAUSE
}

// Logging
const LOGGER = new Logger('Event', LOGGING_LEVEL);

/**
 * The event page
 * @class Event
 */
class Event extends React.Component<IProps, IState> {
  // GraphQL common class
  private graphQlCommon: GraphQLCommon;
  // Create root cause subscription
  private createRootCauseSubscription: any;
  // Delete root cause subscription
  private deleteRootCauseSubscription: any;

  constructor(props: Readonly<IProps>) {
    super(props);

    this.state = {
      title: I18n.get('text.events'),
      events: [],
      isLoading: false,
      searchKeyword: '',
      sort: SortBy.Asc,
      error: '',
      siteId: '',
      siteName: '',
      areaId: '',
      areaName: '',
      processId: '',
      processName: '',
      eventId: '',
      eventName: '',
      eventDescription: '',
      eventSms: '',
      eventEmail: '',
      eventPriority: EventPriority.Low,
      eventType: '',
      eventTopicArn: '',
      modalType: ModalType.None,
      modalTitle: '',
      showModal: false,
      isModalProcessing: false,
      isEventNameValid: false,
      isEventDescriptionValid: false,
      isEventSmsValid: true,
      isEventEmailValid: true,
      isEventTypeValid: true,
      selectAllRootCauses: false,
      eventImgKeys: [],
      eventImgKey: '',
      eventModalError: '',
      showEventImageLibrary: false,
      eventAlias: '',
      isEventAliasValid: false
    };

    this.graphQlCommon = new GraphQLCommon();

    this.deleteEvent = this.deleteEvent.bind(this);
    this.openModal = this.openModal.bind(this);
    this.handleSearchKeywordChange = this.handleSearchKeywordChange.bind(this);
    this.handleSort = this.handleSort.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.loadEventImages = this.loadEventImages.bind(this);
  }

  /**
   * React componentDidMount function
   */
  async componentDidMount() {
    // Get process
    await this.getProcess();
  }

  /**
   * React componentWillUnmount function
   */
  componentWillUnmount() {
    if (this.createRootCauseSubscription) this.createRootCauseSubscription.unsubscribe();
    if (this.deleteRootCauseSubscription) this.deleteRootCauseSubscription.unsubscribe();
  }

  async loadEventImages() {
    this.setState({ isModalProcessing: true });
    try {
      const eventImgs = await Storage.list('event-images/', { level: 'public' });
      this.setState({
        eventImgKeys: eventImgs.map((img: any) => img.key)
      });
    } catch (err) {
      console.error(err);
    }

    this.setState({ isModalProcessing: false });
  }

  /**
   * Get the process detail.
   */
  async getProcess() {
    this.setState({
      isLoading: true,
      error: ''
    });

    try {
      // Graphql operation to get a site
      const { processId } = this.props.match.params;
      const response = await API.graphql(graphqlOperation(getProcess, { id: processId })) as GraphQLResult;
      const data: any = response.data;
      const resultData = data.getProcess;

      const siteId = resultData.area.site.id;
      const siteName = `: ${resultData.area.site.name}`;
      const areaId = resultData.area.id;
      const areaName = `: ${resultData.area.name}`;
      let events: IEvent[] = resultData.event.items;

      // Make all events visible.
      makeAllVisible(events);

      // Sorts initially
      events.sort((a, b) => a.name.localeCompare(b.name));
      this.setState({
        siteId,
        siteName,
        areaId,
        areaName,
        processId,
        events,
        title: `${I18n.get('text.events')} (${events.length})`
      });
    } catch (error) {
      LOGGER.error('Error while getting process', error);
      this.setState({ error: I18n.get('error.get.process') });
    }

    this.setState({ isLoading: false });
  }

  /**
   * Delete an event.
   */
  async deleteEvent() {
    this.setState({ isModalProcessing: true });

    try {
      const { eventId } = this.state;
      await this.graphQlCommon.deleteEvent(eventId);

      const updatedEvents = this.state.events.filter(event => event.id !== eventId);

      this.props.handleNotification(I18n.get('info.delete.event'), 'success', 5);
      this.setState({
        events: updatedEvents,
        title: `${I18n.get('text.events')} (${updatedEvents.length})`,
        eventId: '',
        eventName: '',
        isModalProcessing: false,
        showModal: false,
        modalTitle: '',
        modalType: ModalType.None
      });
    } catch (error) {
      let message = I18n.get('error.delete.event');

      const castError = error as any;

      if (castError.errors) {
        const { errorType } = castError.errors[0];

        if (errorType === 'Unauthorized') {
          message = I18n.get('error.not.authorized');
        }
      }

      LOGGER.error('Error while delete event', castError);
      this.props.handleNotification(message, 'error', 5);
      this.setState({ isModalProcessing: false });
    }
  }

  /**
   * Open modal based on type input.
   * @param {ModalType} modalType- Modal type
   * @param {IEvent | undefined} event - Event
   */
  async openModal(modalType: ModalType, event?: IEvent) {
    let modalTitle = '';

    if (modalType === ModalType.Delete) {
      modalTitle = I18n.get('text.delete.event');
    } else {
      this.props.handleNotification(`${I18n.get('error.unsupported.modal.type')}: ${modalType}`, 'warning', 5);
      return;
    }

    let eventId = '';
    let eventName = '';
    let eventDescription = '';
    let eventSms = '';
    let eventEmail = '';
    let eventTopicArn = '';
    let eventPriority = EventPriority.Low;
    let eventImgKey = '';

    if (event) {
      eventId = event.id ? event.id : '';
      eventName = event.name;
      eventDescription = event.description;
      eventSms = event.sms ? event.sms : '';
      eventEmail = event.email ? event.email : '';
      eventImgKey = event.eventImgKey ? event.eventImgKey : '';

      for (const priority in EventPriority) {
        if (priority === event.priority) {
          eventPriority = EventPriority[priority as keyof typeof EventPriority];
          break;
        }
      }
    }

    await this.loadEventImages();

    this.setState({
      modalType,
      modalTitle,
      eventId,
      eventName,
      eventDescription,
      eventPriority,
      eventSms,
      eventEmail,
      eventTopicArn,
      eventImgKey,
      showModal: true,
      eventModalError: '',
      showEventImageLibrary: false
    });
  }

  /**
   * Get unique root causes from the provided array.
   * @param {string[]} rootCauses - Array to get unique root causes
   * @return {string[]} Unique root causes array
   */
  getUniqueRootCauses(rootCauses: string[]): string[] {
    return Array.from(new Set(rootCauses));
  }

  /**
   * Handle the search keyword change to filter the events result.
   * @param {any} event - Event from the search keyword input
   */
  handleSearchKeywordChange(event: any) {
    const searchKeyword = event.target.value;
    const { events } = this.state;

    makeVisibleBySearchKeyword(events, 'name', searchKeyword);
    this.setState({ events, searchKeyword });
  }

  /**
   * Handle events sort by site name.
   * @param {any} event - Event from the sort by select
   */
  handleSort(event: any) {
    const sort = event.target.value;
    const events = (sortByName(this.state.events, sort, 'name') as IEvent[]);

    this.setState({ events, sort });
  }

  /**
   * Handle modal close.
   */
  handleModalClose() {
    this.setState({
      eventId: '',
      eventName: '',
      eventDescription: '',
      eventEmail: '',
      eventSms: '',
      eventPriority: EventPriority.Low,
      eventType: '',
      isEventNameValid: false,
      isEventDescriptionValid: false,
      isEventSmsValid: true,
      isEventEmailValid: true,
      isEventTypeValid: true,
      selectAllRootCauses: false,
      showModal: false
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
                <LinkContainer to="/sites" exact>
                  <Breadcrumb.Item>{I18n.get('text.sites')}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/sites/${this.state.siteId}`} exact>
                  <Breadcrumb.Item>{I18n.get('text.areas')}{this.state.siteName}</Breadcrumb.Item>
                </LinkContainer>
                <LinkContainer to={`/areas/${this.state.areaId}/processes`} exact>
                  <Breadcrumb.Item>{I18n.get('info.processes')}{this.state.areaName}</Breadcrumb.Item>
                </LinkContainer>
                <Breadcrumb.Item active>{I18n.get('text.events')}{this.state.processName}</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form>
                <Form.Row className="justify-content-end">
                  <Button size="sm" variant="primary" onClick={() => this.props.history.push(`/processes/${this.state.processId}/event`)}>{I18n.get('button.add.event')}</Button>
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
                        <Form.Label>{I18n.get('text.search.keyword')}</Form.Label>
                        <Form.Control type="text" placeholder={I18n.get('text.search.event.name')} defaultValue={this.state.searchKeyword} onChange={this.handleSearchKeywordChange} />
                      </Form.Group>
                      <Form.Group as={Col} md={4} controlId="sortBy">
                        <Form.Label>{I18n.get('text.sort.by')}</Form.Label>
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
              this.state.events.length === 0 && !this.state.isLoading &&
              <Col>
                <Jumbotron>
                  <p>{I18n.get('text.no.event')}</p>
                </Jumbotron>
              </Col>
            }
            {
              this.state.events.filter((event: IEvent) => event.visible)
                .map((event: IEvent) => {
                  let { priority } = event;
                  priority = I18n.get(`text.priority.${priority}`);

                  if (priority.includes('text.priority')) {
                    priority = I18n.get('text.not.found');
                  }

                  let eventImg;
                  if (event.eventImgKey) {
                    eventImg = (
                      <div className="event-image-thumbnail-container">
                        <AmplifyS3Image
                          key="event-image"
                          className="amplify-s3-image event-image-thumbnail"
                          imgKey={event.eventImgKey} />
                      </div>
                    );
                  } else {
                    eventImg = '';
                  }

                  return (
                    <Col md={4} key={event.id}>
                      <Card className="custom-card">
                        <Card.Body>
                          <Card.Title>
                            {event.name}
                          </Card.Title>
                          <Table striped bordered>
                            <tbody>
                              <tr>
                                <td>{I18n.get('text.description')}</td>
                                <td>{event.description}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.sms')}</td>
                                <td>{event.sms}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.email')}</td>
                                <td>{event.email}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.priority')}</td>
                                <td>{priority}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.type')}</td>
                                <td>{event.eventType}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.rootcauses')}</td>
                                <td>
                                  {
                                    event.rootCauses ? `${event.rootCauses.length} ${I18n.get('text.attached.rootcause')}` : ''
                                  }
                                </td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.event.id')}</td>
                                <td>{event.id}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.event.image')}</td>
                                <td>{eventImg}</td>
                              </tr>
                              <tr>
                                <td>{I18n.get('text.event.alias')}</td>
                                <td>{event.alias}</td>
                              </tr>
                            </tbody>
                          </Table>
                          <Form>
                            <Form.Row className="justify-content-between">
                              <Button id={`deleteEvent_${event.id}`} size="sm" variant="danger"
                                onClick={() => this.openModal(ModalType.Delete, event)}>{I18n.get('button.delete')}</Button>
                              <Button id={`editEvent_${event.id}`} size="sm" variant="primary" onClick={() => this.props.history.push(`/processes/${this.state.processId}/event/${event.id}`)}>{I18n.get('button.edit')}</Button>
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
                  <strong>{I18n.get('error')}:</strong><br />
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
            this.state.modalType === ModalType.Delete &&
            <div>
              <Modal.Body>
                {I18n.get('text.confirm.delete.event')}: <strong>{this.state.eventName}</strong>?
              </Modal.Body>
              <Modal.Footer>
                <Button id="deleteEventClose" variant="secondary" onClick={this.handleModalClose}>{I18n.get('button.close')}</Button>
                <Button id="deleteEventDelete" variant="danger" onClick={this.deleteEvent} disabled={this.state.isModalProcessing}>{I18n.get('button.delete')}</Button>
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

export default Event;