/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const { DynamoDbPersistenceAdapter } = require('ask-sdk-dynamodb-persistence-adapter');

const dynamoDbPersistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : 'MoodTracker', createTable: true })

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechText = 'Welcome to your Mood Tracker! What\'s your mood today?';
    const repromptText = 'What\'s your mood today?'

    return handlerInput.responseBuilder
    .speak(speechText)
    .reprompt(repromptText)
    .withSimpleCard('Mood Tracker', speechText)
    .getResponse();
  },
};

const MoodIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'MoodIntent';
  },
  handle(handlerInput) {
    const speechText = 'Thanks! I just recorded it! Do you want to see an overview of your past moods?';
    const repromptText = 'Hi, do you want to see an overview of your past moods?';

    let mood = handlerInput.requestEnvelope.request.intent.slots.mood.value;
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    if (sessionAttributes[mood]) {
      sessionAttributes[mood]++;
    } else {
      sessionAttributes[mood] = 1;
    }

    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
    .speak(speechText)
    .reprompt(repromptText)
    .withSimpleCard('Mood Tracker', speechText)
    .getResponse();
  },
};

const YesIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'YesIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let speechText = 'Hmm! You\'ve been ';
    let repromptText = 'Do you want to hear your summary again?';

    for (let key in sessionAttributes) {
      if (key != 'isInitialized') {
        if (sessionAttributes[key] > 1) {
          speechText += key + ' ' + sessionAttributes[key] + ' times, ';
        } else {
          speechText += key + ' ' + sessionAttributes[key] + ' time, ';
        }
      }
    }

    speechText = speechText.substring(0, speechText.length - 2) + '.';
    return handlerInput.responseBuilder
    .speak(speechText + ' ' + repromptText)
    .reprompt(repromptText)
    .withSimpleCard('Mood Tracker', speechText)
    .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'You can record your mood to me! Just let me know if you\'re happy, sad, angry, exhausted, or sick';

    return handlerInput.responseBuilder
    .speak(speechText)
    .reprompt(speechText)
    .withSimpleCard('Mood Tracker', speechText)
    .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
    && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
    || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  async handle(handlerInput) {
    const speechText = 'Goodbye! Don\'t forget to track your mood tomorrow';
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    await saveUser(handlerInput, sessionAttributes, 'persistent');
    return handlerInput.responseBuilder
    .speak(speechText)
    .withSimpleCard('Mood Tracker', speechText)
    .withShouldEndSession(true)
    .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.withShouldEndSession(true).getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
    .speak('Sorry, I can\'t understand the command. Please say again.')
    .reprompt('Sorry, I can\'t understand the command. Please say again.')
    .getResponse();
  },
};

const GetUserDataInterceptor = {
  process(handlerInput) {
    let attributes = handlerInput.attributesManager.getSessionAttributes();
    if (handlerInput.requestEnvelope.request.type === 'LaunchRequest' && !attributes['isInitialized']) {
      return new Promise((resolve, reject) => {
        handlerInput.attributesManager.getPersistentAttributes()
        .then((attributes) => {
          attributes['isInitialized'] = true;
          saveUser(handlerInput, attributes, 'session');
          resolve();
        })
        .catch((error) => {
          reject(error);
        })
      });
    }
  }
};

function saveUser(handlerInput, attributes, mode) {
  if (mode === 'session'){
    handlerInput.attributesManager.setSessionAttributes(attributes);
  } else if (mode === 'persistent') {
    console.info("Saving to Dynamo: ", attributes);
    return new Promise((resolve, reject) => {
      handlerInput.attributesManager.getPersistentAttributes()
      .then((persistent) => {
        delete attributes['isInitialized'];
        handlerInput.attributesManager.setPersistentAttributes(attributes);

        resolve(handlerInput.attributesManager.savePersistentAttributes());
      })
      .catch((error) => {
        reject(error);
      });
    });
  }
}

const PersistenceSavingResponseInterceptor = {
  process(handlerInput) {
    return new Promise((resolve, reject) => {
      handlerInput.attributesManager.savePersistentAttributes()
      .then(() => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
    });
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
.addRequestHandlers(
  LaunchRequestHandler,
  MoodIntentHandler,
  YesIntentHandler,
  HelpIntentHandler,
  CancelAndStopIntentHandler,
  SessionEndedRequestHandler
)
.addErrorHandlers(ErrorHandler)
.addRequestInterceptors(GetUserDataInterceptor)
.withPersistenceAdapter(dynamoDbPersistenceAdapter)
.lambda();
