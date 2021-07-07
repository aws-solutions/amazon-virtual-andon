// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

 // Import React and Amplify packages
import React from 'react';
import { I18n } from 'aws-amplify';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Jumbotron from 'react-bootstrap/Jumbotron';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {}

/**
 * State Interface
 * @interface IState
 */
interface IState {}

/**
 * The default home page
 * @class Home
 */
class Home extends React.Component<IProps, IState> {
  /**
   * Render this page.
   */
  render() {
    return (
      <Container>
        <Row>
          <Col>
            <Jumbotron className="text-alig-center">
              <h2>Amazon Virtual Andon</h2>
              <p>
                { I18n.get('text.user.guide.for.more.information') }&nbsp;<a href="https://docs.aws.amazon.com/solutions/latest/amazon-virtual-andon/automated-deployment.html" target="_blank" rel="noopener noreferrer">{ I18n.get('text.user.guide') }</a>
              </p>
            </Jumbotron>
          </Col>
        </Row>
      </Container>
    )
  }
}

export default Home;