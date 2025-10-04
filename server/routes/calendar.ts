import { Router } from 'express';
import { addEventToCalendar } from '../services/calendarService';

const router = Router();

router.post('/add-to-calendar', async (req, res) => {
  try {
    const { task, date, time, description } = req.body;

    if (!task || !date) {
      return res.status(400).json({ error: 'Task and date are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Validate time format if provided (HH:MM)
    if (time) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(time)) {
        return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
      }
    }

    const event = await addEventToCalendar({
      summary: task,
      description: description || `Action item from document`,
      date,
      time,
      durationMinutes: 60, // Default 1 hour
    });

    res.json({
      success: true,
      event: {
        id: event.id,
        htmlLink: event.htmlLink,
        summary: event.summary,
        start: event.start,
      },
    });
  } catch (error: any) {
    console.error('Error adding event to calendar:', error);
    
    // Check if it's an authentication error
    if (error.message?.includes('not connected')) {
      return res.status(401).json({ 
        error: 'Google Calendar not connected',
        message: 'Please connect your Google Calendar in the settings'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to add event to calendar',
      message: error.message 
    });
  }
});

export default router;
