2################################################################################
# Copyright (C) 2012-2013 Leap Motion, Inc. All rights reserved.               #
# Leap Motion proprietary and confidential. Not for distribution.              #
# Use subject to the terms of the Leap Motion SDK Agreement available at       #
# https://developer.leapmotion.com/sdk_agreement, or another agreement         #
# between Leap Motion and you, your company or other organization.             #
################################################################################

import Leap, sys, thread, time
from Leap import CircleGesture, KeyTapGesture, ScreenTapGesture, SwipeGesture

DUMP_FILE = "leap.dat"
if DUMP_FILE != None:
    dump_file_opened = open(DUMP_FILE, "wb")
else:
    dump_file_opened = None

def write_file(packed):
    dump_file_opened.write(struct.pack("i", len(packed)))
    dump_file_opened.write(packed)

current_data = {
  'left': {
    'seen': False,
    'thumb_distal': [ 0, 0, 0 ],
    'index_distal': [ 0, 0, 0 ],
    'position': [ 0, 0, 0 ],
    'normal': [ 0, 0, 0 ],
  },
  'right': {
    'seen': False,
    'thumb_distal': [ 0, 0, 0 ],
    'index_distal': [ 0, 0, 0 ],
    'position': [ 0, 0, 0 ],
    'normal': [ 0, 0, 0 ],
  },
}

import zmq, msgpack

zmq_context = zmq.Context()
zmq_pub = zmq_context.socket(zmq.PUB)
zmq_pub.setsockopt(zmq.SNDHWM, 1000)
zmq_pub.setsockopt(zmq.SNDBUF, 1000000)
zmq_pub.setsockopt(zmq.RATE, 1000000)
zmq_pub.bind("tcp://*:62000")

def publish_frame(state):
    state['time'] = time.time()
    packed = msgpack.packb(state)
    zmq_pub.send(packed)
    write_file(packed)


class SampleListener(Leap.Listener):
    finger_names = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
    bone_names = ['Metacarpal', 'Proximal', 'Intermediate', 'Distal']
    state_names = ['STATE_INVALID', 'STATE_START', 'STATE_UPDATE', 'STATE_END']

    def on_init(self, controller):
        print "Initialized"

    def on_connect(self, controller):
        print "Connected"

        # Enable gestures
        controller.enable_gesture(Leap.Gesture.TYPE_CIRCLE);
        controller.enable_gesture(Leap.Gesture.TYPE_KEY_TAP);
        controller.enable_gesture(Leap.Gesture.TYPE_SCREEN_TAP);
        controller.enable_gesture(Leap.Gesture.TYPE_SWIPE);

    def on_disconnect(self, controller):
        # Note: not dispatched when running in a debugger.
        print "Disconnected"

    def on_exit(self, controller):
        print "Exited"

    def on_frame(self, controller):
        # Get the most recent frame and report some basic information
        frame = controller.frame()

        print "Frame id: %d, timestamp: %d, hands: %d, fingers: %d, tools: %d, gestures: %d" % (
              frame.id, frame.timestamp, len(frame.hands), len(frame.fingers), len(frame.tools), len(frame.gestures()))

        for hand in current_data:
            current_data[hand]['seen'] = False

        # Get hands
        for hand in frame.hands:
            if hand.is_left:
                target = current_data['left']
            else:
                target = current_data['right']
            target['seen'] = True
            target['position'] = [ hand.palm_position.x, hand.palm_position.y, hand.palm_position.z ]
            target['normal'] = [ hand.palm_normal.x, hand.palm_normal.y, hand.palm_normal.z ]

            # Get the hand's normal vector and direction
            normal = hand.palm_normal
            direction = hand.direction

            # # Calculate the hand's pitch, roll, and yaw angles
            # print "  pitch: %f degrees, roll: %f degrees, yaw: %f degrees" % (
            #     direction.pitch * Leap.RAD_TO_DEG,
            #     normal.roll * Leap.RAD_TO_DEG,
            #     direction.yaw * Leap.RAD_TO_DEG)

            # # Get arm bone
            # arm = hand.arm
            # print "  Arm direction: %s, wrist position: %s, elbow position: %s" % (
            #     arm.direction,
            #     arm.wrist_position,
            #     arm.elbow_position)

            # Get fingers
            for finger in hand.fingers:

                # print "    %s finger, id: %d, length: %fmm, width: %fmm" % (
                #     self.finger_names[finger.type()],
                #     finger.id,
                #     finger.length,
                #     finger.width)

                # Get bones
                for b in range(0, 4):
                    bone = finger.bone(b)
                    if finger.type() == 0 and bone.type == 3:
                        target['thumb_distal'] = [ bone.next_joint.x, bone.next_joint.y, bone.next_joint.z ]
                    if finger.type() == 1 and bone.type == 3:
                        target['index_distal'] = [ bone.next_joint.x, bone.next_joint.y, bone.next_joint.z ]


                    # print "      Bone: %s, start: %s, end: %s, direction: %s" % (
                    #     self.bone_names[bone.type],
                    #     bone.prev_joint,
                    #     bone.next_joint,
                    #     bone.direction)

        # # Get tools
        # for tool in frame.tools:

        #     print "  Tool id: %d, position: %s, direction: %s" % (
        #         tool.id, tool.tip_position, tool.direction)

        # # Get gestures
        # for gesture in frame.gestures():
        #     if gesture.type == Leap.Gesture.TYPE_CIRCLE:
        #         circle = CircleGesture(gesture)

        #         # Determine clock direction using the angle between the pointable and the circle normal
        #         if circle.pointable.direction.angle_to(circle.normal) <= Leap.PI/2:
        #             clockwiseness = "clockwise"
        #         else:
        #             clockwiseness = "counterclockwise"

        #         # Calculate the angle swept since the last frame
        #         swept_angle = 0
        #         if circle.state != Leap.Gesture.STATE_START:
        #             previous_update = CircleGesture(controller.frame(1).gesture(circle.id))
        #             swept_angle =  (circle.progress - previous_update.progress) * 2 * Leap.PI

        #         print "  Circle id: %d, %s, progress: %f, radius: %f, angle: %f degrees, %s" % (
        #                 gesture.id, self.state_names[gesture.state],
        #                 circle.progress, circle.radius, swept_angle * Leap.RAD_TO_DEG, clockwiseness)

        #     if gesture.type == Leap.Gesture.TYPE_SWIPE:
        #         swipe = SwipeGesture(gesture)
        #         print "  Swipe id: %d, state: %s, position: %s, direction: %s, speed: %f" % (
        #                 gesture.id, self.state_names[gesture.state],
        #                 swipe.position, swipe.direction, swipe.speed)

        #     if gesture.type == Leap.Gesture.TYPE_KEY_TAP:
        #         keytap = KeyTapGesture(gesture)
        #         print "  Key Tap id: %d, %s, position: %s, direction: %s" % (
        #                 gesture.id, self.state_names[gesture.state],
        #                 keytap.position, keytap.direction )

        #     if gesture.type == Leap.Gesture.TYPE_SCREEN_TAP:
        #         screentap = ScreenTapGesture(gesture)
        #         print "  Screen Tap id: %d, %s, position: %s, direction: %s" % (
        #                 gesture.id, self.state_names[gesture.state],
        #                 screentap.position, screentap.direction )

        # if not (frame.hands.is_empty and frame.gestures().is_empty):
        #     print ""
        publish_frame(current_data)
        time.sleep(0.01)

    # def state_string(self, state):
    #     if state == Leap.Gesture.STATE_START:
    #         return "STATE_START"

    #     if state == Leap.Gesture.STATE_UPDATE:
    #         return "STATE_UPDATE"

    #     if state == Leap.Gesture.STATE_STOP:
    #         return "STATE_STOP"

    #     if state == Leap.Gesture.STATE_INVALID:
    #         return "STATE_INVALID"

def main():
    # Create a sample listener and controller
    listener = SampleListener()
    controller = Leap.Controller()

    # Have the sample listener receive events from the controller
    controller.add_listener(listener)

    # Keep this process running until Enter is pressed
    print "Press Enter to quit..."
    try:
        sys.stdin.readline()
    except KeyboardInterrupt:
        pass
    finally:
        # Remove the sample listener when done
        controller.remove_listener(listener)


if __name__ == "__main__":
    main()
