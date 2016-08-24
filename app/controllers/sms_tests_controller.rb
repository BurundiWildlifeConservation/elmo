class SmsTestsController < ApplicationController
  # authorization via CanCan
  load_and_authorize_resource :class => "Sms::Test"

  def new
  end

  # handles a request for a test. this will be an AJAX call so we only return the message body
  def create
    # create an incoming sms object
    sms = Sms::Incoming.create(adapter_name: 'Test Console',
      to: nil,
      from: params[:sms_test][:from],
      body: params[:sms_test][:body],
      mission: current_mission
    )

    reply, forward = Sms::Handler.new.handle(sms)
    if reply
      reply.adapter_name = "Test Console"
      reply.save
    end

    if forward
      forward.adapter_name = "Test Console"
      forward.save
    end

    # render the body of the reply
    render text: reply ? reply.body : content_tag(:em, t('sms_console.no_reply'))
  end

  protected
    # specify the class the this controller controls, since it's not easily guessed
    def model_class
      Sms::Test
    end
end
