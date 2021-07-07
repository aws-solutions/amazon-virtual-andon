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
 * The class returns an error when path matches nothing.
 * @class NoMatch
 */
class NoMatch extends React.Component {
  /**
   * Render the page
   */
  render() {
    return (
      <div className="view">
        <Container>
          <Row>
            <Col>
              <Jumbotron>
                <h3>{ I18n.get('text.not.found') }: <code>{window.location.pathname}</code></h3>
              </Jumbotron>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default NoMatch;