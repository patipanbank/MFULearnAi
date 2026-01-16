<template>
  <div class="c-email-app mb-4">
    <div class="c-body flex-row">
      <EmailNav/>
      <main class="flex-shrink-1">
        <MailToolbar/>
        <ul class="c-messages">
          <InboxMessage/>
          <InboxMessage read/>
          <InboxMessage read/>
          <InboxMessage/>
          <InboxMessage read/>
          <InboxMessage/>
          <InboxMessage read/>
          <InboxMessage read/>
          <InboxMessage read/>
          <InboxMessage read/>
          <InboxMessage read/>
          <InboxMessage/>
          <InboxMessage read/>
        </ul>
      </main>
    </div>
  </div>
</template>

<script>
import EmailNav from './EmailNav'
import InboxMessage from './InboxMessage'
import MailToolbar from './MailToolbar'

export default {
  name: 'Inbox',
  components: {
    EmailNav,
    InboxMessage,
    MailToolbar
  }
}
</script>
