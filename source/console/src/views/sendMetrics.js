import axios from "axios";
import configurations from 'variables/configurations'
import { Logger } from 'aws-amplify';
const logger = new Logger(configurations.logger.name, configurations.logger.level);
declare var andon_config;

const sendMetrics = async (data) => {
    if (andon_config.solutions_send_metrics === 'true') {
        try {
            await axios.post(andon_config.solutions_metrics_endpoint, {
                Data: {
                    Resource: data,
                    Version: andon_config.solutions_version,
                    Region: andon_config.aws_project_region,
                },
                Solution: andon_config.solutions_solutionId,
                TimeStamp: `${new Date().toISOString().replace(/T/, ' ')}`,
                UUID: andon_config.solutions_solutionUuId,
            }, {
                headers: { 'Content-Type': 'application/json' }
            }
            )
            logger.debug(`metrics sent successfully`)
        }
        catch (e) { logger.error(`error in sending anonymous metrics: ${e}`) }
    }
}

export default sendMetrics;