/**
 * Example hooks for survey flow
 *
 * Demonstrates:
 * - Multiple afterCapture actions on one step
 * - Conditional logic triggering different actions
 * - BeforeRender for personalization
 */

const surveyResponses = [];

/**
 * AfterCapture: Log rating to database
 */
export async function logRating(variable, value, session) {
  console.log(`[Database] User ${session.senderId} rated: ${value}/5`);

  const response = {
    userId: session.senderId,
    timestamp: new Date().toISOString(),
    rating: value,
  };

  surveyResponses.push(response);
}

/**
 * AfterCapture: Log feedback text
 */
export async function logFeedback(variable, value, session) {
  console.log(`[Database] Feedback from ${session.senderId}: ${value}`);

  const response = surveyResponses.find(r =>
    r.userId === session.senderId &&
    !r.feedback
  );

  if (response) {
    response.feedback = value;
  }
}

/**
 * AfterCapture: Notify support team for low ratings
 */
export async function notifySupport(variable, value, session) {
  const rating = session.variables.rating;

  console.log(`[Support Alert] Low rating (${rating}/5) from user ${session.senderId}`);
  console.log(`Feedback: ${value}`);

  // In real implementation: send Slack notification, email, etc.
}

/**
 * BeforeRender: Personalize thank you message based on rating
 */
export async function personalizeThankYou(step, session) {
  const rating = session.variables.rating;

  let message = step.message;

  if (rating >= 4) {
    message = "🎉 Thank you for the great feedback! We're glad you're happy with our service.";
  } else if (rating >= 3) {
    message = "Thanks for your feedback! We'll work on making things better.";
  } else {
    message = "Thank you for your honest feedback. We're committed to improving.";
  }

  return { ...step, message };
}

/**
 * Global lifecycle hooks
 */
export default {
  async onFlowComplete(session) {
    console.log('Survey completed:', session.variables);

    // Calculate average rating across all responses
    if (surveyResponses.length > 0) {
      const avg = surveyResponses.reduce((sum, r) => sum + r.rating, 0) / surveyResponses.length;
      console.log(`Average rating: ${avg.toFixed(2)}/5.0`);
    }
  }
};
