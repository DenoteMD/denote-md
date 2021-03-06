// Load the AWS SDK for Node.js
import AWS from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { Utilities } from 'noqueue';
import config from '../helper/config';
import logger from '../helper/logger';
import { Singleton } from '../framework';

// Set the region
AWS.config.update({
  // @todo: move this to configuration and .env
  region: 'ap-southeast-1',
});

/**
 * Core send mail which will be use in sign in/ sign up
 * @export
 * @class SendMail
 */
export class SendMail {
  /**
   * Instance of AWS SES v2
   * @private
   * @type {AWS.SESV2}
   * @memberof SendMail
   */
  private awsSesV2: AWS.SESV2;

  /**
   * Creates an instance of SendMail.
   * @param {string} accessKeyId
   * @param {string} secretAccessKey
   * @memberof SendMail
   */
  constructor(accessKeyId: string, secretAccessKey: string) {
    this.awsSesV2 = new AWS.SESV2({
      apiVersion: '2019-09-27',
      accessKeyId,
      secretAccessKey,
    });
  }

  /**
   * Send an mail request
   * @param {AWS.SESV2.Types.SendEmailRequest} sendMailRequest
   * @return {Promise<AWS.SESV2.Types.SendEmailResponse>}
   * @memberof SendMail
   */
  public async sendMailRequest(
    sendMailRequest: AWS.SESV2.Types.SendEmailRequest,
  ): Promise<AWS.SESV2.Types.SendEmailResponse> {
    // Retry 3 times before throw an error
    return Utilities.TillSuccess(async () => {
      return this.awsSesV2.sendEmail(sendMailRequest).promise();
    });
  }

  /**
   * Send an email with content
   * @param {string} from
   * @param {string} to
   * @param {string} subject
   * @param {string} html
   * @param {string} text
   * @return {Promise<AWS.SESV2.Types.SendEmailResponse>}
   * @memberof SendMail
   */
  public async sendEmail(
    from: string,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<AWS.SESV2.Types.SendEmailResponse> {
    // This one is for development
    // For now AWS limit number of email send and receiver address
    if (config.nodeEnv === 'development') {
      logger.debug('Email sent > from:', from, 'to:', to);
      logger.debug('Subject:', subject);
      logger.debug('Html:', html);
      logger.debug('Text:', text);
      return { MessageId: uuid() };
    }
    return this.sendMailRequest({
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
          },
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
        },
      },
      FromEmailAddress: from,
      ReplyToAddresses: [from],
    });
  }
}

export const AwsMailInstance = Singleton<SendMail>('aws-mail-sender', SendMail, config.awsKeyId, config.awsAccessKey);

export default SendMail;
